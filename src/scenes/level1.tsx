import Phaser from 'phaser';
import { render } from 'phaser-jsx';

import { TilemapDebug, Typewriter, Dialog } from '../components';
import { key } from '../constants';
import { state } from '../state';
import { NPC } from '../sprites/NPC';
import { Agent } from '../sprites/Agent';
import { fetchChatCompletion } from '../server/server';
import { controlAgentMovements, initKeyboardInputs } from '../utils/controlUtils';
import { setupKeyListeners } from '../utils/controlUtils';
import { AgentPerspectiveKeyMapping } from '../utils/controlUtils';
import { addAgentPanelHUD, addAgentSelectionMenuHUD, addSceneNameHUD } from '../utils/hudUtils';
import { createItem } from '../utils/sceneUtils';
import { debate } from '../server/llmUtils';
import { ParentScene } from './ParentScene';
import { setupScene } from '../utils/sceneUtils';


interface Sign extends Phaser.Physics.Arcade.StaticBody {
  text?: string;
}

interface MessageRecord {
  system: string;
  user: string;
  gpt: string;
}

export class Level1 extends ParentScene {

  private inputElement!: HTMLInputElement;
  private isInputLocked: boolean = true;  // Locked input state
  private dialog: Phaser.GameObjects.Container | null = null;

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
      { group: this.itemGroup, callback: (player:any, item:any) => {
        this.collectItem(player, item, "think step by step")} },
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
            debate('Is the earth flat?', 3);
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

    // API Key validation

    localStorage.clear();

    this.dialog = this.add.container(0, 0);

    // console.log("local storage", localStorage.getItem('openai-api-key'));

    if(!localStorage.getItem("openai-api-key") && !import.meta.env.VITE_OPENAI_API_KEY){render(
      <Dialog
        text="Enter OpenAI API Key:"
        isInputLocked={this.isInputLocked}
        setIsInputLocked={(locked) => {
          this.isInputLocked = locked;
          console.log('Lock status updated:', this.isInputLocked);
        }}
        onEnd={() => {
          
          // Destroy the Dialog component and remove DOM elements
          if (localStorage.getItem('openai-api-key')) {
            state.isAPIAvailable = true;
            this.dialog?.destroy(); // Destroy the Phaser container
            this.dialog = null;
    
            // Remove input and button from the DOM
            const input = document.querySelector('input');
            const button = document.querySelector('button');
            if (input) input.remove();
            if (button) button.remove();
          }
        }}
      />,
      this
    )};

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

    // this.testRoute().then((result) => {
    //   console.log('route result', result);
    // });



  }

  
  
  update() {
    if (this.isInputLocked) {
      return;
    }

    //console.log(this.scene.manager.scenes);

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
      console.log('Key "8" pressed');
      this.scene.start('level2');
      
    } 
  }
}
