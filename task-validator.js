// Task validation logic for tunnl.ai Chrome Extension

class TaskValidator {
    constructor(settings, retryRequest) {
        this.settings = settings;
        this.retryRequest = retryRequest;
    }

    /**
     * Get system prompt for task validation
     */
    getTaskValidationSystemPrompt() {
        return `
You are a helpful assistant that understands task descriptions. Your job is to analyze any task description and extract the key components.

For any task description, respond with a JSON object containing:
	•	topic: string (the main subject/domain the user is working on, e.g., "SaaS tools", "React development", "hosting providers", "marketing")
	•	action: string (what the user is trying to accomplish, e.g., "research pricing", "write blog post", "compare options", "plan campaign")
	•	effectiveness: string (brief opinion on how effective this task is for detecting distractions, e.g., "Very effective - clear focus on specific domain, good for distraction blocking", "Moderately effective - could be more specific for better distraction blocking", "Less effective - too broad for distraction bblocking")

Examples:
- "Research competitor pricing for SaaS tools" → topic: "SaaS tools", action: "research pricing", effectiveness: "Very ..."
- "Compare hosting providers" → topic: "hosting providers", action: "compare options", effectiveness: "Very ..."
- "Write blog post about React hooks" → topic: "React development", action: "write blog post", effectiveness: "Very ..."
- "Work on project" → topic: "general project work", action: "work on project", effectiveness: "Less ..."
- "Be productive" → topic: "general productivity", action: "be productive", effectiveness: "Less ..."

Always provide all three fields: topic, action, and effectiveness. Be helpful and interpret the user's intent.
`;
    }

    /**
     * Parse task validation response from OpenAI
     */
    parseTaskValidationResponse(content) {
        try {
            const result = JSON.parse(content);
            console.log('Parsed task understanding:', result);
            return {
                topic: result.topic || 'Unknown topic',
                action: result.action || 'Unknown action',
                effectiveness: result.effectiveness || 'Moderately effective - assessment unavailable'
            };
        } catch (parseError) {
            console.log('JSON parse error, using fallback:', parseError);
            return {
                topic: 'Unknown topic',
                action: 'Unknown action',
                effectiveness: 'Moderately effective - assessment unavailable'
            };
        }
    }

    /**
     * Validate a task description using OpenAI API
     */
    async validateTask(taskText) {
        console.log('Understanding task:', taskText);
        
        if (!this.settings.openaiApiKey) {
            console.log('Extension not configured - API key missing');
            return { 
                topic: 'General task', 
                action: 'Work on task',
                effectiveness: 'Moderately effective - API not configured'
            };
        }

        try {
            const response = await this.retryRequest(async () => {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.settings.openaiApiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-3.5-turbo',
                        messages: [
                            {
                                role: 'system',
                                content: this.getTaskValidationSystemPrompt()
                            },
                            {
                                role: 'user',
                                content: `Analyze this task description: "${taskText}"`
                            }
                        ],
                        temperature: 0.3,
                        max_tokens: 200
                    })
                });

                if (!response.ok) {
                    throw new Error(`OpenAI API error: ${response.status}`);
                }

                return response;
            }, 3, 1000);

            const data = await response.json();
            const content = data.choices[0].message.content;
            console.log('Task understanding response:', content);

            return this.parseTaskValidationResponse(content);

        } catch (error) {
            console.error('Task understanding API error:', error);
            return {
                topic: 'General task',
                action: 'Work on task',
                effectiveness: 'Moderately effective - API error occurred'
            };
        }
    }
}
