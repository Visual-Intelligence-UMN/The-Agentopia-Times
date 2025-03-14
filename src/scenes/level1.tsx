import Phaser from 'phaser';
import { render } from 'phaser-jsx';

import { TilemapDebug, Typewriter } from '../components';
import { key } from '../constants';
import { state } from '../state';
import { NPC } from '../sprites/NPC';
import { Agent } from '../sprites/Agent';
import { fetchChatCompletion } from '../server/server';
import { controlAgentMovements, initKeyboardInputs, controlAgentWithMouse, controlCameraMovements, isClickOnHUD } from '../utils/controlUtils';
import { setupKeyListeners } from '../utils/controlUtils';
import { AgentPerspectiveKeyMapping } from '../utils/controlUtils';
import { addAgentPanelHUD, addAgentSelectionMenuHUD, addSceneNameHUD, drawArrow } from '../utils/hudUtils';
import { createItem } from '../utils/sceneUtils';
import { debate } from '../server/llmUtils';
import { ParentScene } from './ParentScene';
import { setupScene } from '../utils/sceneUtils';
import { LEVEL1_STARTING_TUTORIAL } from '../utils/dialogs';
import { calculateDistance } from '../utils/mathUtils';


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
  private graphics: Phaser.GameObjects.Graphics | null = null;

  private hudElements: Phaser.GameObjects.GameObject[] = []; // Store all HUD elements

  private isCameraFollowing: boolean = false; // Default camera does not follow



  constructor() {
    super();
  }

  create() {

    // Initialize the HUD array
    this.hudElements = [];

    setupScene.call(this);


    this.coinGroup = this.physics.add.group();

    this.graphics = this.add.graphics({ lineStyle: { width: 2, color: 0xffffff } });

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
        this.collectItem(player, item, "think step by step", this.itemText)} },
      { group: this.deductiveItem, callback: (player:any, item:any) => {
        this.collectItem(player, item, "deductive reasoning", this.deductiveItemText)}  },
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


    this.anims.create({
      key: "coin",       
      frames: this.anims.generateFrameNumbers("coin", { start: 0, end: 7 }), 
      frameRate: 10, 
      repeat: -1    
    });

    const coin = this.physics.add.sprite(400, 1200, 'coin').play('coin');
    this.coinGroup.add(coin);

    this.physics.add.overlap(this.agentGroup, this.coinGroup, (agent, coin) => {
      console.log("Coin collected!");
      this.credits ++;
        coin.destroy(); 
        this.creditsText.setText(this.credits.toString());
    }, undefined, this);



    this.agentGroup.add(agent1);

    this.controllableCharacters.push(agent1);

    console.log('controled characters', this.controllableCharacters);

    //set the camera
    this.cameras.main.startFollow(this.controllableCharacters[0]);

    // 1 second to unfollow the camera, allowing the player to move freely.
    this.time.delayedCall(1, () => {
      this.cameras.main.stopFollow();
    }, [], this);


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

    // state.isTypewriting = true;
    // render(
    //   <Typewriter
    //     text="WASD or arrow keys to move, space to interact; 1, 2, and 3 to switch agents."
    //     onEnd={() => (state.isTypewriting = false)}
    //   />,
    //   this,
    // );

    this.renderDialog(LEVEL1_STARTING_TUTORIAL, 0);

    // API Key validation

    // localStorage.clear();

    this.dialog = this.add.container(0, 0);

    // console.log("local storage", localStorage.getItem('openai-api-key'));



    // Limit the camera movement range to prevent it from going beyond the map range.
    this.cameras.main.setBounds(0, 0, this.tilemap.widthInPixels, this.tilemap.heightInPixels);
  
    // console.log("HUD Elements List:", this.hudElements);

  }
  


  update() {
    // if (this.isInputLocked) {
    //   return;
    // }

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

    if(calculateDistance(
      {
        x: this.playerControlledAgent.x, 
        y: this.playerControlledAgent.y
      }, 
      {
        x: 600, 
        y: 900
      }
    )>100){
      this.graphics?.clear();
      drawArrow.call(
        this, 
        {
          x: this.playerControlledAgent.x, 
          y: this.playerControlledAgent.y
        }, 
        {
          x: 600, 
          y: 900
        }, 
        50, 
        this.graphics
      );
    } else {
      this.graphics?.clear();
    }
    
    /* Control Aengent */

    // controlAgentMovements(this.playerControlledAgent, this.cursors);
    controlAgentWithMouse(this, this.playerControlledAgent, this.tilemap, 
      (pointer) => isClickOnHUD(pointer, this.hudElements) // Pass in the HUD array
    );


    const cursors = this.input!.keyboard!.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // Getting Camera Behavior Right
    controlCameraMovements(this, cursors, 10);

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