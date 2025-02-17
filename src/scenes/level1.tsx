import Phaser from 'phaser';
import { render } from 'phaser-jsx';

import { TilemapDebug, Typewriter } from '../components';
import { key } from '../constants';
import { state } from '../state';
import { NPC } from '../sprites/NPC';
import { Agent } from '../sprites/Agent';
import { fetchChatCompletion } from '../server/server';
import { controlAgentMovements, initKeyboardInputs } from '../utils/controlUtils';
import { setupKeyListeners } from '../utils/controlUtils';
import { addAgentPanelHUD, addAgentSelectionMenuHUD, addButtonHUD, addSceneNameHUD } from '../utils/hudUtils';
import { createItem, setupScene } from '../utils/sceneUtils';
import { debateWithJudging } from '../server/simulations/debate';
import { ParentScene } from './ParentScene';
import { chain, parallel, route } from '../server/llmUtils';

export class Level1 extends Phaser.Scene {

  constructor() {
    super();
  }

  create() {
    setupScene.call(this);

    this.itemText = this.add.text(350, 950, 'think step-by-step');
    this.deductiveItemText = this.add.text(450, 1050, 'deductive reasoning');

    this.tweens.add({
      targets: [this.itemText, this.deductiveItemText], 
      y: '+=10', 
      duration: 800, 
      ease: 'Sine.easeInOut', 
      yoyo: true, 
      repeat: -1, 
    });

    createItem.call(this, this.itemGroup, 400, 1000, 'logo');
    createItem.call(this, this.deductiveItem, 500, 1100, 'logo');
    createItem.call(this, this.debatePositionGroup, 700, 900, 'logo');
    createItem.call(this, this.debatePositionGroup, 900, 900, 'logo');

    const overlaps = [
      { group: this.itemGroup, callback: this.collectItem },
      { group: this.deductiveItem, callback: this.collectDeductiveReasoning },
    ];

    overlaps.forEach(({ group, callback }) => {
      this.physics.add.overlap(
        this.agentGroup,
        group,
        callback,
        undefined,
        this,
      );
    });

    this.npc = new NPC(this, 600, 900);
    this.physics.add.collider(this.npc, this.worldLayer);

    this.physics.add.collider(this.agentGroup, this.worldLayer);

    const agent1 = new Agent(this, 350, 1200, 'player', 'misa-front', 'Alice');

    this.agentGroup.add(agent1);

    this.controllableCharacters.push(agent1);

    console.log('controled characters', this.controllableCharacters);

    //set the camera
    this.cameras.main.startFollow(this.controllableCharacters[0]);
    this.controllableCharacters[0].changeNameTagColor('#ff0000');

    this.physics.add.overlap(
      this.agentGroup,
      this.npc,
      this.onPlayerNearNPC,
      undefined,
      this,
    );

    

    render(<TilemapDebug tilemapLayer={this.worldLayer} />, this);

    const squareSize = 50;
    const spacing = 20;
    const startX = 75;
    const startY = 520;
    addAgentPanelHUD.call(this, startX, startY, squareSize, spacing);

    // add controls UI
    this.agentControlButtons = this.add.group();
    this.agentControlButtonLabels = [];

    addAgentSelectionMenuHUD.call(this);
    this.overlappedItems = new Set();
    let overlappedItems = new Set();
    let isDebate = false;
    let debateStartBtn = null;
    let debateStartLabel = null;

    this.physics.add.overlap(

      this.agentGroup,
      this.debatePositionGroup,
      (agent, item) => {
        if (!overlappedItems.has(item)) {
          overlappedItems.add(item);
          this.events.emit('overlapstart', agent, item);
        }

        if (overlappedItems.size === 2 && !isDebate) {
          isDebate = true;
          console.log('Agent is overlapping both debate positions!');
          debateStartBtn = this.add
            .rectangle(50, 330, 50, 50, 0x000000)
            .setScrollFactor(0)
            .setDepth(1001)
            .setAlpha(0.5)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive();

          debateStartLabel = this.add
            .text(35, 320, 'Start Debate', {
              fontSize: '10px',
              color: '#ffffff',
              wordWrap: { width: 50, useAdvancedWrap: true },
            })
            .setScrollFactor(0)
            .setDepth(1002);
          debateStartBtn.on('pointerdown', (pointer: any) => {
            console.log('start debate!!');
            debateWithJudging('Is the earth flat?', 3);
          });
        }
      },
    );

    this.debatePositionGroup.on('overlapsend', (item: any, agent: any) => {
      console.log('overlapsend', item, agent);
      isDebate = false;

      overlappedItems.delete(item);
    });

    state.isTypewriting = true;
    render(
      <Typewriter
        text="WASD or arrow keys to move, space to interact; 1, 2, and 3 to switch agents."
        onEnd={() => (state.isTypewriting = false)}
      />,
      this,
    );

    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.pause(key.scene.main);
      this.scene.launch(key.scene.menu);
    });

    
    // this.testChain().then((result) => {
    //   console.log('chain result', result);
    // });

    // this.testParallel().then((result) => {
    //   console.log('parallel result', result);
    // });

    this.testRoute().then((result) => {
      console.log('route result', result);
    });



  }

  private async testChain(){
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

  private async testParallel(){
    const inputs = [
      "How many R's are in the word strawberry?",
      "How many R's are in the word strawberry?",
      "How many R's are in the word strawberry?"
    ];

    const responses = await parallel('What is the capital of France?', inputs);
    console.log('responses', responses);
    return responses;
  }

  private async testRoute(){
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

    let results:string[] = [];

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
  
  update() {
    this.playerControlledAgent =
      this.controllableCharacters[this.activateIndex];

    for (let i = 0; i < 3; i++) {
      if (i < this.playerControlledAgent.getPromptUtils().length) {
        this.promptTexts[i].setText(
          this.playerControlledAgent.getPromptUtils()[i],
        );
      } else {
        this.promptTexts[i].setText('empty');
      }
    }

    this.controllableCharacters.forEach((agent: any) => {
      agent.update();
    });

    this.hudText.setText(
      `${this.controllableCharacters[this.activateIndex].getName()}(Player-controlled) `,
    );

    if (
      this.input.keyboard!.checkDown(
        this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
        250,
      )
    ) {
      console.log('Key "1" pressed');
      this.activateIndex = 0;
      this.cameras.main.startFollow(
        this.controllableCharacters[this.activateIndex],
      );
      this.playerControlledAgent =
        this.controllableCharacters[this.activateIndex];
      this.controllableCharacters.forEach((agent: any) => {
        agent.changeNameTagColor('#ffffff');
      });
      this.playerControlledAgent.changeNameTagColor('#ff0000');
      console.log(
        'switched utils',
        this.playerControlledAgent.getPromptUtils(),
      );
    } 

    controlAgentMovements(this.playerControlledAgent, this.cursors);

    this.agentGroup.on('overlapstart', (agent: any, item: any) => {
      console.log('overlapstart', agent, item);
    });

    if(this.cursors.seven.isDown) {
    } else if(this.cursors.eight.isDown) {
      this.scene.start('level2');
    } else if(this.cursors.nine.isDown) {
      this.scene.start(key.scene.main);
    }
  }
}
