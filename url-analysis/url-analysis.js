// URL analysis and blocking orchestration (service-worker friendly)
// Exposes UrlAnalysis with methods that operate on a provided context (ctx)

const UrlAnalysis = {
    async analyzeAndBlockUrl(ctx, url, tabId) {
        console.log('🔍 Starting URL analysis (module):', { url, tabId });
        try {
            // Site-level cache key (uses ctx.normalizeHostname and settings)
            const host = ctx.normalizeHostname(url);
            let cacheKey;
            if (typeof self !== 'undefined' && typeof self.buildCacheKey === 'function') {
                cacheKey = self.buildCacheKey({
                    useCategories: ctx.settings.useCategories,
                    url,
                    selectedCategories: ctx.settings.selectedCategories,
                    taskText: ctx.settings.currentTask?.text || ''
                });
            } else {
                if (ctx.settings.useCategories) {
                    const categoriesKey = ctx.settings.selectedCategories.join(',');
                    cacheKey = `host:${host}||categories:${categoriesKey}`;
                } else {
                    const taskKey = ctx.settings.currentTask?.text || '';
                    cacheKey = `host:${host}||task:${taskKey}`;
                }
            }

            console.log('💾 Cache check:', {
                cacheKey: cacheKey.substring(0, 100) + '...',
                hasCache: ctx.urlCache.has(cacheKey)
            });

            if (ctx.urlCache.has(cacheKey)) {
                const cachedResult = ctx.urlCache.get(cacheKey);
                console.log('✅ Cache hit:', {
                    shouldBlock: cachedResult.shouldBlock,
                    reason: cachedResult.reason,
                    timestamp: new Date(cachedResult.timestamp).toISOString()
                });

                if (cachedResult.shouldBlock && ctx.settings.extensionEnabled) {
                    await UrlAnalysis.notifyBlockSuggestion(ctx, url, {
                        shouldBlock: true,
                        reason: 'From Cache: ' + (cachedResult.reason || 'Potentially distracting'),
                        activityUnderstanding: cachedResult.activityUnderstanding || 'Cached analysis',
                        confidence: cachedResult.confidence || 0.8
                    }, tabId);
                } else if (cachedResult.shouldBlock && !ctx.settings.extensionEnabled) {
                    console.log('📊 Cached says block, extension disabled - data only');
                }
                return;
            }

            // Content extraction orchestration (DOM first, then fetch)
            let extractedContent = null;
            if (ctx.contentExtractionEnabled) {
                console.log('🔍 Trying DOM-based content extraction first:', url);
                try {
                    if (typeof tabId === 'number') {
                        const domResult = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' });
                        if (domResult && domResult.success && domResult.content) {
                            extractedContent = domResult.content;
                            console.log('✅ DOM content extracted');
                        } else {
                            console.log('⚠️ DOM extraction returned empty, falling back to fetch');
                        }
                    } else {
                        console.log('⚠️ No tabId provided; skipping DOM extraction');
                    }
                } catch (err) {
                    console.log('⚠️ DOM extraction failed (content script not ready/CSP?):', err?.message);
                }

                if (!extractedContent) {
                    console.log('🔍 Attempting fetch-based content extraction fallback:', url);
                    try {
                        extractedContent = await ctx.extractContentFromUrl(url);
                        if (extractedContent) {
                            const firstWords = extractedContent.split(' ').slice(0, 10).join(' ');
                            console.log('✅ Fallback content extracted (first 10 words):', `"${firstWords}..."`);
                        } else {
                            console.log('⚠️ Fallback extraction returned empty result');
                        }
                    } catch (error) {
                        console.warn('❌ Fallback extraction failed:', url, error);
                    }
                }
            } else {
                console.log('⏭️ Content extraction disabled, skipping for URL:', url);
            }

            // Analyze URL
            console.log('🤖 Calling OpenAI API for analysis...');
            const analysis = await UrlAnalysis.analyzeUrl(ctx, url, extractedContent);

            console.log('🧠 AI Analysis result:', analysis);

            // Cache
            ctx.urlCache.set(cacheKey, { ...analysis, timestamp: Date.now() });
            console.log('💾 Cached analysis result');

            // Stats
            if (ctx.statsManager) {
                await ctx.statsManager.incrementUrlsAnalyzed();
            }

            if (analysis.shouldBlock && ctx.settings.extensionEnabled) {
                await UrlAnalysis.notifyBlockSuggestion(ctx, url, analysis, tabId);
            } else if (analysis.shouldBlock && !ctx.settings.extensionEnabled) {
                console.log('📊 Would block but extension disabled - data only');
            } else {
                console.log('✅ URL allowed, no action needed');
            }
        } catch (error) {
            console.error('Error analyzing URL (module):', error);
        }
    },

    async analyzeUrl(ctx, url, extractedContent = null) {
        // Delegate to existing class method if present for compatibility
        if (ctx && typeof ctx.analyzeUrl === 'function' && ctx !== UrlAnalysis) {
            // prevent recursion by checking ctx
        }

        console.log('🔍 Analyzing URL (module):', url);
        if (!ctx.settings.openaiApiKey) {
            return { shouldBlock: false, reason: 'Not configured', activityUnderstanding: 'No API key', confidence: 0 };
        }

        if (ctx.isAllowlisted(url)) {
            return { shouldBlock: false, reason: 'Allowlisted site', activityUnderstanding: 'Site is in allowlist', confidence: 1.0 };
        }

        if (ctx.settings.useCategories) {
            if (!ctx.settings.selectedCategories || ctx.settings.selectedCategories.length === 0) {
                return { shouldBlock: false, reason: 'No categories selected', activityUnderstanding: 'No categories selected', confidence: 0.5 };
            }

            const knownCategory = ctx.getKnownUrlCategory(url);
            if (knownCategory) {
                const shouldBlock = ctx.settings.selectedCategories.includes(knownCategory);
                return {
                    shouldBlock,
                    reason: shouldBlock ? `Known ${knownCategory} site` : `Known ${knownCategory} site (not blocked)`,
                    activityUnderstanding: `This is a known ${knownCategory} website`,
                    confidence: 0.95
                };
            }

            const quickCategoryCheck = ctx.quickCategoryCheck(url, ctx.settings.selectedCategories);
            if (quickCategoryCheck.shouldBlock) return quickCategoryCheck;
        } else {
            const currentTaskText = ctx.settings.currentTask?.text?.text || ctx.settings.currentTask?.text;
            const normalizedCurrentTaskText = typeof currentTaskText === 'string' ? currentTaskText.trim() : '';
            if (!normalizedCurrentTaskText) {
                return { shouldBlock: false, reason: 'No current task selected', activityUnderstanding: 'No active task', confidence: 0.5 };
            }
        }

        // Build prompts and call OpenAI (reuse existing retryRequest)
        try {
            const response = await ctx.retryRequest(async () => {
                // Simplified: reuse original prompt builder paths
                let systemPrompt;
                const recent = ctx.recentUrls.length > 0 ? ctx.recentUrls.map((u, i) => `${i + 1}. ${u}`).join('\n') : 'No recent URLs available';

                if (ctx.settings.useCategories) {
                    systemPrompt = `You are a productivity assistant...\nSelected categories to block: ${ctx.settings.selectedCategories.join(', ')}\nRecent browsing context:\n${recent}\nCurrent URL to analyze: ${url}`;
                } else {
                    const currentTaskText = ctx.settings.currentTask?.text?.text || ctx.settings.currentTask?.text;
                    const normalizedCurrentTaskText = typeof currentTaskText === 'string' ? currentTaskText.trim() : '';
                    systemPrompt = `You are a productivity assistant...\nCurrent activities/tasks: "${normalizedCurrentTaskText}"\nRecent browsing context:\n${recent}\nCurrent URL to analyze: ${url}`;
                }

                const body = {
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Analyze this URL: ${url}${extractedContent ? `\n\nWebsite content (extracted):\n${extractedContent}` : ''}` }
                    ],
                    temperature: 0.3,
                    max_tokens: 200
                };

                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${ctx.settings.openaiApiKey}`
                    },
                    body: JSON.stringify(body)
                });
                if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
                return res;
            }, 3, 1000);

            const data = await response.json();
            const content = data.choices[0].message.content || '';
            try {
                const result = JSON.parse(content);
                const reason = (result.reason || '').toString();
                let confidence = typeof result.confidence === 'number' ? result.confidence : 0.5;
                let shouldBlock = !!result.shouldBlock;
                const lower = reason.toLowerCase();
                const unrelatedSignals = ['not related','not relevant','unrelated','irrelevant','distracting','off-topic','different topic','different domain'];
                if (!shouldBlock && unrelatedSignals.some(s => lower.includes(s)) && confidence >= 0.6) {
                    shouldBlock = true;
                }
                return {
                    shouldBlock,
                    reason: reason || 'No reason provided',
                    activityUnderstanding: result.activityUnderstanding || 'No activity understanding provided',
                    confidence
                };
            } catch {
                return {
                    shouldBlock: content.toLowerCase().includes('block') && content.toLowerCase().includes('true'),
                    reason: 'AI analysis completed (fallback)',
                    activityUnderstanding: 'Unable to parse activity understanding',
                    confidence: 0.5
                };
            }
        } catch (error) {
            console.error('OpenAI API error:', error);
            return { shouldBlock: false, reason: `Error: ${error.message}`, activityUnderstanding: 'Error occurred during analysis', confidence: 0 };
        }
    },

    async notifyBlockSuggestion(ctx, url, analysis, tabId) {
        console.log('🚨 Preparing block notification (module):', { url, analysis, tabId });
        try {
            const reason = analysis.reason || 'Potentially distracting';
            const activityUnderstanding = analysis.activityUnderstanding || 'Unable to understand activities';
            const confidence = typeof analysis.confidence === 'number' ? Math.round(analysis.confidence * 100) : undefined;

            // Track suggested block in settings (short)
            const shortReason = reason.substring(0, 50);
            ctx.settings.blockedSites.push({ url: url.substring(0, 100), timestamp: Date.now(), reason: `Suggest: ${shortReason}` });
            if (ctx.settings.blockedSites.length > 30) ctx.settings.blockedSites = ctx.settings.blockedSites.slice(-30);
            if (ctx.statsManager) await ctx.statsManager.incrementUrlsBlocked();
            await ctx.saveSettings();

            if (typeof tabId === 'number') {
                await ctx.sendMessageWithRetry(tabId, {
                    type: 'SHOW_BLOCK_MODAL',
                    url,
                    message: reason,
                    activityUnderstanding,
                    currentTask: ctx.settings.currentTask?.text || 'No active task'
                });
            }

            // Badge nudge
            try {
                const previousBadge = await chrome.action.getBadgeText({});
                const previousColor = await chrome.action.getBadgeBackgroundColor({});
                await chrome.action.setBadgeText({ text: '!' });
                await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
                setTimeout(() => {
                    chrome.action.setBadgeText({ text: previousBadge || (ctx.settings.extensionEnabled ? 'ON' : 'OFF') });
                    chrome.action.setBadgeBackgroundColor({ color: previousColor || (ctx.settings.extensionEnabled ? '#6b46c1' : '#9ca3af') });
                }, 8000);
            } catch (badgeErr) {
                console.log('❌ Failed to set badge:', badgeErr.message);
            }
        } catch (error) {
            console.error('Error showing block suggestion (module):', error);
        }
    }
};

// Expose globally for service worker
if (typeof self !== 'undefined') self.UrlAnalysis = UrlAnalysis;


