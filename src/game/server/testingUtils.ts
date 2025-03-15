import { callLLM, chain, parallel, route } from '../server/llmUtils';
import { EventEmitter } from "events";
import { autoControlAgent } from '../utils/controlUtils';
import { EventBus } from '../EventBus';
import { Zone } from '../scenes';
import { transformDataMap } from '../../langgraph/langgraphUtils';

export const eventTargetBus = new EventTarget();

export async function testChain(
  agent1: any, 
  agent2: any, 
  scene: any, 
  tilemap: any,
  zones: Zone[]
) {
  scene.registry.set("isWorkflowRunning", true);
  console.log("start workflow", scene.registry.get("isWorkflowRunning"));
  console.log("in the function", zones);

  

  const researcherPrompts = [
      `You are a data analyst at a top news agency. Your task is to extract all quantitative information (numbers, percentages, currency values) from the given report.
      Format each extracted value with its corresponding metric in the format: 'value: metric'.
      Ensure that the extracted data retains context and is meaningful for financial and performance analysis.
      Example:
      92: Customer Satisfaction Score
      45%: Annual Revenue Growth`,

      `As a financial researcher, convert all extracted numerical values into a standard format.
      - Convert scores to percentages (e.g., 92 points -> 92%).
      - Keep financial values (e.g., revenue or cost) as-is.
      - Ensure each value remains on a separate line.
      Example:
      92%: Customer Satisfaction Score
      45%: Annual Revenue Growth`,

      `You are a journalist preparing an industry report. Organize the extracted data in descending order of importance, starting with the most impactful business metrics.
      Example:
      92%: Customer Satisfaction Score
      87%: Employee Satisfaction Score
      45%: Annual Revenue Growth`
  ];

  const report = `
      Q3 Performance Report:
      This quarter, customer satisfaction increased to 92 points, showing a strong positive trend.
      Annual revenue saw a 45% growth, surpassing projections.
      Our market share now stands at 23% in our primary sector.
      Customer churn dropped from 8% to 5%, indicating stronger customer retention.
      The cost of acquiring a new user is now $43 per user.
      Our product adoption rate is at 78%, reflecting positive reception.
      Employee satisfaction has climbed to 87 points, showing workplace improvements.
      Operating margin improved significantly, reaching 34%.
  `;

  console.log("🔍 Researcher: Extracting and refining key business data...");
  const researchResult = await chain(report, researcherPrompts);

  // signal 1
  eventTargetBus.dispatchEvent(new CustomEvent("signal", { detail: "signal 1" }));

  const originalAgent1X = agent1.x;
  const originalAgent1Y = agent1.y;

  console.log("debug 1", agent2?.x, agent2?.y, originalAgent1X, originalAgent1Y);

  await autoControlAgent(scene, agent1, tilemap, (agent2?.x as number), (agent2?.y as number), "Send Message to "+(agent2?.name as string));

  const writerPrompts = [
      `As a financial journalist, format the given data as a concise and well-structured Markdown table for an industry report.
      - Use clear, professional language.
      - Ensure the table is aligned correctly and values are formatted consistently.
      - The table should have two columns: 'Metric' and 'Value'.
      Example:
      | Metric | Value |
      |:--|--:|
      | Customer Satisfaction | 92% |`
  ];

  console.log("📝 News Writer: Formatting the processed business report...");
  const finalResult = await chain(researchResult, writerPrompts);

  EventBus.emit("final-report", {report:String(finalResult)});

  // signal 2
  eventTargetBus.dispatchEvent(new CustomEvent("signal", { detail: "signal 2" }));
  await autoControlAgent(scene, agent1, tilemap, originalAgent1X, originalAgent1Y, "Return to Office");


  console.log("Final Output:", finalResult);

  //240, 290
  const originalAgent2X = agent2.x;
  const originalAgent2Y = agent2.y;
  await autoControlAgent(scene, agent2, tilemap, 240, 290, "Send Report to Final Location");
  await autoControlAgent(scene, agent2, tilemap, originalAgent2X, originalAgent2Y, "Return to Office");

  await scene.registry.set("isWorkflowRunning", false);
  await console.log("end workflow", scene.registry.get("isWorkflowRunning"));

  return finalResult;
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

export async function testChainCustomerSupport() {
  const prompts = [
      `Step 1: Extract the key issue from the customer inquiry.
      Example:
      Inquiry: "I was charged $49.99 instead of $29.99."
      Key Issue: Unexpected charge on account.

      Inquiry: "I forgot my password and can't log in."
      Key Issue: Account access issue.

      Inquiry: [CUSTOMER_INQUIRY]
      Key Issue:`,

      `Step 2: Classify the issue into one of the following categories: 
      - billing
      - technical
      - account
      - product

      Example:
      Key Issue: Unexpected charge on account.
      Category: billing

      Key Issue: Account access issue.
      Category: account

      Key Issue: [PREVIOUS_STEP_OUTPUT]
      Category:`,

      `Step 3: Generate a structured response based on the category.
      Example:
      Category: billing
      Response:
      "Billing Support Response: We acknowledge your concern about the unexpected charge. 
      Your plan was upgraded on [DATE], leading to the price difference. If this was unintentional, 
      you can revert by downgrading your plan in settings."

      Category: account
      Response:
      "Account Support Response: If you forgot your password, please reset it using the ‘Forgot Password’ 
      option. If you still can’t access your account, contact our security team."

      Category: [PREVIOUS_STEP_OUTPUT]
      Response:`,

      `Step 4: Format the response professionally.
      Example:
      Raw Response: "Billing Support Response: We acknowledge your concern..."
      Formatted Response:
      --------------------------------------
      **Billing Support Team**
      We acknowledge your concern...
      --------------------------------------

      Raw Response: [PREVIOUS_STEP_OUTPUT]
      Formatted Response:`
  ];

  const customerInquiry = `I just noticed a charge of $49.99 on my credit card, 
  but I thought I was on the $29.99 plan. Can you explain this charge and adjust it if it's a mistake?`;

  const result = await chain(customerInquiry, prompts);
  console.log('Chain Mode Output:', result);
  return result;
}


export async function evaluateCustomerSupportResponse(pattern: string, response: string) {
  const evaluationPrompt = `
  You are an expert evaluator of customer service responses in a multi-agent system.
  Your job is to analyze the provided response based on the following criteria:
  
  1. **Clarity**: Is the response easy to understand?
  2. **Accuracy**: Does it provide the correct and relevant information?
  3. **Helpfulness**: Does it guide the customer to a resolution effectively?

  **Scoring Criteria**:
  - Rate each category from 1 (poor) to 10 (excellent).
  - Provide a brief justification for each rating.
  - If there are issues, suggest improvements.

  **Example Evaluation**:
  ---
  **Response:** "Billing Support Response: We checked your billing details and found that your plan was upgraded..."
  **Evaluation:**
  - Clarity: 9/10 - The response is well-structured and professional.
  - Accuracy: 8/10 - Provides relevant information but lacks a refund policy explanation.
  - Helpfulness: 7/10 - Guides the user but could add alternative solutions.
  - Suggested Improvements: Add refund policy details for clarity.

  Now evaluate the following response from the **${pattern}** method:

  **Customer Support Response:**
  ${response}

  **Your Evaluation:**
  `;

  const evaluationResult = await callLLM([{ role: 'user', content: evaluationPrompt }]);
  return evaluationResult.choices[0].message.content;
}


export async function testParallelCustomerSupport() {
  const inputs = [
      `Step 1: Summarize the customer's issue in one sentence.
      Example:
      Inquiry: "I was charged $49.99 instead of $29.99."
      Summary: The customer is concerned about an unexpected billing charge.

      Inquiry: "I can't log into my account."
      Summary: The customer has trouble accessing their account.

      Inquiry: [CUSTOMER_INQUIRY]
      Summary:`,

      `Step 2: Retrieve similar past customer inquiries and solutions.
      Example:
      Inquiry: "I was charged $49.99 instead of $29.99."
      Similar Case: Customer X had a billing mismatch because their subscription was upgraded.
      Solution: Informed them of the upgrade and provided a downgrade option.

      Inquiry: [CUSTOMER_INQUIRY]
      Similar Case: `,

      `Step 3: Generate a professional response based on customer history.
      Example:
      Inquiry: "I was charged $49.99 instead of $29.99."
      Response:
      "Billing Support Response: We checked your billing details and found that your plan was upgraded 
      on [DATE]. If this was unintentional, you can revert to the lower plan in your account settings."

      Inquiry: [CUSTOMER_INQUIRY]
      Response:`
  ];

  const customerInquiry = `I just noticed a charge of $49.99 on my credit card, 
  but I thought I was on the $29.99 plan. Can you explain this charge and adjust it if it's a mistake?`;

  const responses = await parallel(customerInquiry, inputs);
  console.log('Parallel Mode Output:', responses);
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