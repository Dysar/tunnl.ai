// OpenAI API client for tunnl.ai Chrome Extension

import { OPENAI_CONFIG } from '../../shared/constants.js';
import { retryWithBackoff, isValidApiKeyFormat } from '../../shared/utils.js';

class OpenAIClient {
    private apiKey: string | null = null;
    private baseURL: string = OPENAI_CONFIG.API_BASE_URL;

    constructor() {
        // Properties initialized above
    }

    /**
     * Set the API key
     */
    setApiKey(apiKey: string): void {
        if (!isValidApiKeyFormat(apiKey)) {
            throw new Error('Invalid API key format. Must start with "sk-"');
        }
        this.apiKey = apiKey;
    }

    /**
     * Validate API key by making a test request
     */
    async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string; models?: number; message?: string }> {
        if (!isValidApiKeyFormat(apiKey)) {
            return { 
                valid: false, 
                error: 'Invalid API key format. Must start with "sk-"' 
            };
        }

        try {
            const response = await retryWithBackoff(async () => {
                const response = await fetch(`${this.baseURL}${OPENAI_CONFIG.ENDPOINTS.MODELS}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error('Invalid API key - authentication failed');
                    } else if (response.status === 429) {
                        throw new Error('Rate limit exceeded - API key is valid but temporarily limited');
                    } else if (response.status === 403) {
                        throw new Error('API key lacks required permissions');
                    } else {
                        throw new Error(`API error: ${response.status}`);
                    }
                }

                return response;
            }, 2, 1000);

            const data = await response.json();
            console.log('✅ API key validation successful');
            
            return { 
                valid: true, 
                models: data.data?.length || 0,
                message: `API key is valid. Found ${data.data?.length || 0} available models.`
            };

        } catch (error: any) {
            console.log('❌ API key validation failed:', error.message);
            return { 
                valid: false, 
                error: error.message 
            };
        }
    }

    /**
     * Analyze URL for blocking decision
     */
    async analyzeUrl(url: string, currentTask: string | undefined, recentUrls: string[] = []): Promise<{ shouldBlock: boolean; reason: string; activityUnderstanding: string; confidence: number }> {
        if (!this.apiKey) {
            throw new Error('API key not set');
        }

        if (!currentTask || !currentTask.trim()) {
            return {
                shouldBlock: false,
                reason: 'No current task selected',
                activityUnderstanding: 'No active task',
                confidence: 0.5
            };
        }

        try {
            const response = await retryWithBackoff(async () => {
                const response = await fetch(`${this.baseURL}${OPENAI_CONFIG.ENDPOINTS.CHAT_COMPLETIONS}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: OPENAI_CONFIG.MODEL,
                        messages: [
                            {
                                role: 'system',
                                content: this.getAnalysisSystemPrompt(currentTask, recentUrls)
                            },
                            {
                                role: 'user',
                                content: `Analyze this URL: ${url}`
                            }
                        ],
                        temperature: OPENAI_CONFIG.TEMPERATURE,
                        max_tokens: OPENAI_CONFIG.MAX_TOKENS
                    })
                });

                if (!response.ok) {
                    throw new Error(`OpenAI API error: ${response.status}`);
                }

                return response;
            }, 3, 1000);

            const data = await response.json();
            const content = data.choices[0].message.content;
            console.log('🤖 OpenAI raw response:', content);

            return this.parseAnalysisResponse(content);

        } catch (error: any) {
            console.error('OpenAI API error:', error);
            return {
                shouldBlock: false,
                reason: `Error: ${error.message}`,
                activityUnderstanding: 'Error occurred during analysis',
                confidence: 0
            };
        }
    }

    /**
     * Validate task description
     */
    async validateTask(taskText: string): Promise<{ isValid: boolean; reason: string; suggestions: string[]; confidence: number }> {
        if (!this.apiKey) {
            throw new Error('API key not set');
        }

        try {
            const response = await retryWithBackoff(async () => {
                const response = await fetch(`${this.baseURL}${OPENAI_CONFIG.ENDPOINTS.CHAT_COMPLETIONS}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: OPENAI_CONFIG.MODEL,
                        messages: [
                            {
                                role: 'system',
                                content: this.getTaskValidationSystemPrompt()
                            },
                            {
                                role: 'user',
                                content: `Evaluate this task description: "${taskText}"`
                            }
                        ],
                        temperature: 0.3,
                        max_tokens: 300
                    })
                });

                if (!response.ok) {
                    throw new Error(`OpenAI API error: ${response.status}`);
                }

                return response;
            }, 3, 1000);

            const data = await response.json();
            const content = data.choices[0].message.content;
            console.log('Task validation response:', content);

            return this.parseTaskValidationResponse(content);

        } catch (error: any) {
            console.error('Task validation API error:', error);
            return {
                isValid: true, // Default to allowing task if validation fails
                reason: `Validation error: ${error.message}`,
                suggestions: [],
                confidence: 0
            };
        }
    }

    /**
     * Get system prompt for URL analysis
     */
    private getAnalysisSystemPrompt(currentTask: string, recentUrls: string[]): string {
        return `You are a productivity assistant that helps users stay focused on their tasks. 
Analyze the given URL and determine if it's related to the user's current task by understanding the PURPOSE and CONTEXT of the task.

Current activities/tasks: "${currentTask}"

Recent browsing context (last 5 URLs visited):
${recentUrls.length > 0 ? recentUrls.map((url: string, i: number) => `${i + 1}. ${url}`).join('\n') : 'No recent URLs available'}

Respond with a JSON object containing:
- "shouldBlock": boolean (true if the url is not related to the task and would keep the user from completing it)
- "reason": string (brief explanation of why it should/shouldn't be blocked)
- "activityUnderstanding": string (brief explanation of how you understood the user's activities - what they're trying to accomplish)
- "confidence": number (0-1, how confident you are in this decision)

Guidelines:
- Parse tasks to understand the ACTION (researching, buying, learning, etc.) and SUBJECT (bananas, laptops, etc.)
- Look at each aspect of the URL (domain, path, query) to assess relevance to BOTH the action and subject
- Use the recent browsing context to understand the user's workflow and intent
- Consider browsing patterns: if user is researching a topic, allow related sites even if not directly mentioned in task
- Allow sites that are TOOLS or PLATFORMS for completing the task action, even if they're not topically about the subject
- Examples of task-relevant platforms:
  * Research tasks: Allow search engines, Wikipedia, academic sites, news sites, AND e-commerce sites (for product research)
  * Shopping tasks: Allow e-commerce sites, price comparison sites, review sites
  * Learning tasks: Allow educational platforms, documentation sites, tutorial sites
- If a task mentions researching/buying/comparing a product, allow major platforms (Amazon, Google, eBay, etc.) even if the URL doesn't explicitly mention the product
- Block sites that are clearly unrelated entertainment, social media (unless task-relevant), or different topic domains
- Tie-break rule: When task mentions a specific domain or exact URL, always allow
- Always allow: search engines, productivity tools, reference sites
- If unsure about relevance, lean towards allowing (productivity over restriction)
- Consider that users often need to navigate through general platform pages to reach specific content
- Use recent URL context to detect if user is following a logical research/shopping/learning workflow
- If you cant associate websites with the current task, get the overall topic the user is working on from the current task and recent URLs, and only block sites that are clearly unrelated to that topic
- Do not block localhost, intranet, or internal company URLs`;
    }

    /**
     * Get system prompt for task validation
     */
    private getTaskValidationSystemPrompt(): string {
        return `You are a productivity expert helping users write effective task descriptions for a website blocker.

Your job is to evaluate if a task description is well-written for efficient website blocking. A good task description should:
1. Be specific and actionable (not too broad or vague)
2. Clearly indicate what websites would be relevant
3. Be focused enough that the AI can distinguish relevant vs irrelevant sites
4. Not be so broad that it would allow distracting websites

Examples of GOOD task descriptions:
- "Research competitor pricing for SaaS tools"
- "Write blog post about React hooks"
- "Prepare presentation slides for Q4 sales meeting"
- "Debug authentication issues in the login module"

Examples of BAD task descriptions (too broad):
- "Work on project"
- "Be productive"
- "Do research"
- "Learn something new"

Respond with a JSON object containing:
- "isValid": boolean (true if the task is well-described for blocking)
- "reason": string (explanation of why it's valid/invalid)
- "suggestions": array of strings (specific suggestions to improve the task if invalid)
- "confidence": number (0-1, how confident you are in this assessment)`;
    }

    /**
     * Parse analysis response from OpenAI
     */
    private parseAnalysisResponse(content: string): { shouldBlock: boolean; reason: string; activityUnderstanding: string; confidence: number } {
        try {
            const result = JSON.parse(content);
            console.log('✅ Successfully parsed AI response:', result);
            
            const reason = (result.reason || '').toString();
            let confidence = typeof result.confidence === 'number' ? result.confidence : 0.5;
            let shouldBlock = !!result.shouldBlock;

            // Normalize contradictions: if reason clearly says unrelated/not relevant, prefer blocking
            const lower = reason.toLowerCase();
            const unrelatedSignals = [
                'not related', 'not relevant', 'unrelated', 'irrelevant',
                'distracting', 'off-topic', 'different topic', 'different domain'
            ];
            const hasUnrelatedSignal = unrelatedSignals.some(s => lower.includes(s));
            if (!shouldBlock && hasUnrelatedSignal && confidence >= 0.6) {
                console.log('🔄 Overriding decision based on reason analysis - blocking due to unrelated signals');
                shouldBlock = true;
            }

            return {
                shouldBlock,
                reason: reason || 'No reason provided',
                activityUnderstanding: result.activityUnderstanding || 'No activity understanding provided',
                confidence
            };
            
        } catch (parseError) {
            console.log('❌ JSON parse error, using fallback:', parseError);
            // Fallback if JSON parsing fails
            return {
                shouldBlock: content.toLowerCase().includes('block') && content.toLowerCase().includes('true'),
                reason: 'AI analysis completed (fallback)',
                activityUnderstanding: 'Unable to parse activity understanding',
                confidence: 0.5
            };
        }
    }

    /**
     * Parse task validation response from OpenAI
     */
    private parseTaskValidationResponse(content: string): { isValid: boolean; reason: string; suggestions: string[]; confidence: number } {
        try {
            const result = JSON.parse(content);
            console.log('Parsed validation result:', result);
            return {
                isValid: result.isValid || false,
                reason: result.reason || 'No reason provided',
                suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
                confidence: result.confidence || 0.5
            };
        } catch (parseError) {
            console.log('JSON parse error, using fallback:', parseError);
            // Fallback if JSON parsing fails
            return {
                isValid: !content.toLowerCase().includes('invalid') && !content.toLowerCase().includes('too broad'),
                reason: 'AI analysis completed',
                suggestions: [],
                confidence: 0.5
            };
        }
    }
}

// Export singleton instance
export const openaiClient = new OpenAIClient();
export default openaiClient;
