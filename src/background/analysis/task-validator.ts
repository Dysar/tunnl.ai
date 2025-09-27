// Task validation logic for tunnl.ai Chrome Extension

import { openaiClient } from '../api/openai.js';
import { TaskValidationResult } from '../../shared/constants.js';

interface BasicValidationResult {
    isValid: boolean;
    reason: string;
    suggestions: string[];
    confidence: number;
}

interface TaskExamples {
    good: string[];
    bad: string[];
}

class TaskValidator {
    private validationEnabled: boolean = true;

    /**
     * Validate a task description
     */
    async validateTask(taskText: string, apiKey: string): Promise<TaskValidationResult> {
        console.log('Validating task:', taskText);
        
        if (!this.validationEnabled) {
            console.log('Task validation disabled');
            return { 
                isValid: true, 
                reason: 'Validation disabled', 
                suggestions: [], 
                confidence: 1.0
            };
        }

        if (!apiKey) {
            console.log('Extension not configured - API key missing');
            return { 
                isValid: false, 
                reason: 'API key not configured', 
                suggestions: [], 
                confidence: 1.0
            };
        }

        if (!taskText || !taskText.trim()) {
            return {
                isValid: false,
                reason: 'Task description is empty',
                suggestions: ['Please provide a specific task description'],
                confidence: 1.0
            };
        }

        // Basic validation checks
        const basicValidation = this.performBasicValidation(taskText);
        if (!basicValidation.isValid) {
            return basicValidation;
        }

        try {
            // Set API key for OpenAI client
            openaiClient.setApiKey(apiKey);
            
            // Validate with OpenAI
            const result = await openaiClient.validateTask(taskText);
            console.log('Task validation result:', result);
            
            return {
                isValid: result.isValid,
                reason: result.reason,
                suggestions: result.suggestions || [],
                confidence: result.confidence || 0.5
            };

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
     * Perform basic validation checks
     */
    private performBasicValidation(taskText: string): BasicValidationResult {
        const text = taskText.trim();
        
        // Check minimum length
        if (text.length < 10) {
            return {
                isValid: false,
                reason: 'Task description is too short',
                suggestions: [
                    'Provide more specific details about what you want to accomplish',
                    'Include the subject matter or domain you\'ll be working on',
                    'Example: "Research competitor pricing for SaaS tools" instead of "Work on project"'
                ],
                confidence: 1.0
            };
        }

        // Check for overly broad terms
        const broadTerms = [
            'work', 'be productive', 'do research', 'learn something',
            'be creative', 'get things done', 'be efficient', 'study',
            'improve', 'develop', 'create', 'build', 'make'
        ];
        
        const lowerText = text.toLowerCase();
        const hasBroadTerm = broadTerms.some(term => lowerText.includes(term));
        
        if (hasBroadTerm && text.length < 30) {
            return {
                isValid: false,
                reason: 'Task description is too vague',
                suggestions: [
                    'Be more specific about what you want to accomplish',
                    'Include the subject matter or specific goal',
                    'Example: "Write blog post about React hooks" instead of "Write something"',
                    'Example: "Research competitor pricing for SaaS tools" instead of "Do research"'
                ],
                confidence: 0.8
            };
        }

        // Check for actionable verbs
        const actionableVerbs = [
            'write', 'create', 'build', 'develop', 'design', 'implement',
            'research', 'analyze', 'review', 'prepare', 'plan', 'organize',
            'debug', 'fix', 'test', 'deploy', 'publish', 'present',
            'learn', 'study', 'practice', 'improve', 'optimize'
        ];
        
        const hasActionableVerb = actionableVerbs.some(verb => lowerText.includes(verb));
        
        if (!hasActionableVerb) {
            return {
                isValid: false,
                reason: 'Task lacks clear action',
                suggestions: [
                    'Start with an action verb to make the task more specific',
                    'Examples: "Write...", "Research...", "Create...", "Debug..."',
                    'Example: "Write documentation for the new API" instead of "Documentation for API"'
                ],
                confidence: 0.7
            };
        }

        return {
            isValid: true,
            reason: 'Task passes basic validation',
            suggestions: [],
            confidence: 0.6
        };
    }

    /**
     * Get suggestions for improving a task
     */
    getTaskImprovementSuggestions(taskText: string): string[] {
        const suggestions: string[] = [];
        const text = taskText.trim().toLowerCase();
        
        // Check for common issues and provide suggestions
        if (text.length < 20) {
            suggestions.push('Add more specific details about what you want to accomplish');
        }
        
        if (text.includes('work on') || text.includes('do work')) {
            suggestions.push('Replace "work on" with a specific action like "write", "research", or "create"');
        }
        
        if (text.includes('project') && !text.includes('specific')) {
            suggestions.push('Specify what type of project and what you\'ll be doing');
        }
        
        if (text.includes('learn') && !text.includes('about')) {
            suggestions.push('Specify what you want to learn about');
        }
        
        if (text.includes('research') && !text.includes('on') && !text.includes('about')) {
            suggestions.push('Specify what you want to research');
        }
        
        return suggestions;
    }

    /**
     * Enable or disable task validation
     */
    setValidationEnabled(enabled: boolean): void {
        this.validationEnabled = enabled;
        console.log(`Task validation ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if validation is enabled
     */
    isValidationEnabled(): boolean {
        return this.validationEnabled;
    }

    /**
     * Get example good and bad tasks
     */
    getTaskExamples(): TaskExamples {
        return {
            good: [
                'Research competitor pricing for SaaS tools',
                'Write blog post about React hooks',
                'Prepare presentation slides for Q4 sales meeting',
                'Debug authentication issues in the login module',
                'Create wireframes for the new user dashboard',
                'Analyze user feedback from the latest app release',
                'Study machine learning algorithms for recommendation systems',
                'Design database schema for the e-commerce platform'
            ],
            bad: [
                'Work on project',
                'Be productive',
                'Do research',
                'Learn something new',
                'Get things done',
                'Be creative',
                'Improve efficiency',
                'Study hard'
            ]
        };
    }
}

// Export singleton instance
export const taskValidator = new TaskValidator();
export default taskValidator;
