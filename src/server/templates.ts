
export function selector(
    input: string, 
    routes: Map<string, string>
): string {
    return `
        Analyze the input and select the most appropriate support team from these options: 
        ${Object.keys(routes).join(', ')}
        First explain your reasoning, 
        then provide your selection in this XML format:

        <reasoning>
        Brief explanation of why this ticket should be routed to a specific team.
        Consider key terms, user intent, and urgency level.
        </reasoning>

        <selection>
        The chosen team name
        </selection>

        Input: ${input}
    `.trim();
}