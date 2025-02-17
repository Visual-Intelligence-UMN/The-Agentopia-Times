import { chain, parallel, route } from '../server/llmUtils';


export async function testChain() {
    // testing for new LLM APIs
    const prompts = [
        `Extract only the numerical values and their associated metrics from the text.
      Format each as 'value: metric' on a new line.
      Example format:
      92: customer satisfaction
      45%: revenue growth`,
        `Convert all numerical values to percentages where possible.
      If not a percentage or points, convert to decimal (e.g., 92 points -> 92%).
      Keep one number per line.
      Example format:
      92%: customer satisfaction
      45%: revenue growth`,
        `Sort all lines in descending order by numerical value.
      Keep the format 'value: metric' on each line.
      Example:
      92%: customer satisfaction
      87%: employee satisfaction`,
        `Format the sorted data as a markdown table with columns:
      | Metric | Value |
      |:--|--:|
      | Customer Satisfaction | 92% |
      `
    ];

    const report = `
      Q3 Performance Summary:
      Our customer satisfaction score rose to 92 points this quarter.
      Revenue grew by 45% compared to last year.
      Market share is now at 23% in our primary market.
      Customer churn decreased to 5% from 8%.
      New user acquisition cost is $43 per user.
      Product adoption rate increased to 78%.
      Employee satisfaction is at 87 points.
      Operating margin improved to 34%.
    `;

    const result = await chain(report, prompts);
    return result;
}

export async function testParallel() {
    const inputs = [
        "How many R's are in the word strawberry?",
        "How many R's are in the word strawberry?",
        "How many R's are in the word strawberry?"
    ];

    const responses = await parallel('What is the capital of France?', inputs);
    console.log('responses', responses);
    return responses;
}

export async function testRoute() {
    const supportedRoutes = new Map<string, string>([
        ["billing", `You are a billing support specialist. Follow these guidelines:
    1. Always start with "Billing Support Response:"
    2. First acknowledge the specific billing issue
    3. Explain any charges or discrepancies clearly
    4. List concrete next steps with timeline
    5. End with payment options if relevant
    
    Keep responses professional but friendly.
    
    Input: `],
        ["technical", `You are a technical support engineer. Follow these guidelines:
    1. Always start with "Technical Support Response:"
    2. List exact steps to resolve the issue
    3. Include system requirements if relevant
    4. Provide workarounds for common problems
    5. End with escalation path if needed
    
    Use clear, numbered steps and technical details.
    
    Input: `],
        ["account", `You are an account security specialist. Follow these guidelines:
    1. Always start with "Account Support Response:"
    2. Prioritize account security and verification
    3. Provide clear steps for account recovery/changes
    4. Include security tips and warnings
    5. Set clear expectations for resolution time
    
    Maintain a serious, security-focused tone.
    
    Input: `],
        ["product", `You are a product specialist. Follow these guidelines:
    1. Always start with "Product Support Response:"
    2. Focus on feature education and best practices
    3. Include specific examples of usage
    4. Link to relevant documentation sections
    5. Suggest related features that might help
    
    Be educational and encouraging in tone.
    
    Input: `]
    ]);


    const tickets = [
        `Subject: Can't access my account
      Message: Hi, I've been trying to log in for the past hour but keep getting an 'invalid password' error. 
      I'm sure I'm using the right password. Can you help me regain access? This is urgent as I need to 
      submit a report by end of day.
      - John`,

        `Subject: Unexpected charge on my card
      Message: Hello, I just noticed a charge of $49.99 on my credit card from your company, but I thought
      I was on the $29.99 plan. Can you explain this charge and adjust it if it's a mistake?
      Thanks,
      Sarah`,

        `Subject: How to export data?
      Message: I need to export all my project data to Excel. I've looked through the docs but can't
      figure out how to do a bulk export. Is this possible? If so, could you walk me through the steps?
      Best regards,
      Mike`
    ];

    let results: string[] = [];

    tickets.forEach(async (ticket, index) => {
        console.log(`\nTicket ${index}`);
        console.log("-".repeat(40));
        console.log(ticket);
        console.log("Response: ");
        const response = await route(ticket, supportedRoutes);
        console.log(response);
        console.log("-".repeat(40));

        results.push(response);
    });

    return results;


}