import Phaser from 'phaser';
import { render } from 'phaser-jsx';

import { TilemapDebug, Typewriter } from '../components';
import {
  Depth,
  key,
  TilemapLayer,
  TILESET_NAME,
} from '../constants';
import { state } from '../state';
import { NPC } from '../sprites/NPC';
import { Agent } from '../sprites/Agent';
import { controlAgentMovements, initKeyboardInputs } from '../utils/controlUtils';
import { addAgentPanelHUD, addAgentSelectionMenuHUD, addSceneNameHUD } from '../utils/hudUtils';
import { addItem, createItem, setupScene } from '../utils/sceneUtils';
import { debate } from '../server/llmUtils';
import { ParentScene } from './ParentScene';
import { evaluateCustomerSupportResponse, testChainCustomerSupport, testParallelCustomerSupport, testRoute } from '../server/testingUtils';
import { customerServicePersona } from '../server/prompts';

export class Level2 extends ParentScene {

  private parrellePositionGroup!: Phaser.Physics.Arcade.StaticGroup;
  private bird!: Phaser.Physics.Arcade.Sprite;
  private agentIndex: number = 0;
  private isBirdMoving: boolean = false;
  private agentList: Agent[] = [];

  constructor() {
    super("level2");
    this.sceneName = "Game: Level 2";
  }

  create() {

    setupScene.call(this, "office");

    this.tweens.add({
      targets: [this.itemText, this.deductiveItemText], 
      y: '+=10', 
      duration: 800, 
      ease: 'Sine.easeInOut', 
      yoyo: true,
      repeat: -1, 
    });

    // this.anims.create({
    //   key: "bird",
    //   frames: this.anims.generateFrameNumbers("bird", { start: 0, end: 1 }),
    //   frameRate: 10,
    //   repeat: -1,
    // });

    // const bird = this.physics.add.sprite(500, 1000, "bird");
    // bird.play("bird");

    //this.bird = bird;

    createItem.call(this, this.itemGroup, 400, 1000, 'logo');
    createItem.call(this, this.deductiveItem, 500, 1100, 'logo');
    createItem.call(this, this.debatePositionGroup, 700, 900, 'logo');
    createItem.call(this, this.debatePositionGroup, 900, 900, 'logo');
  
  this.physics.world.on('overlapend', (player: any, item: any) => {
      this.onOverlapEnd(player, item);
  });
  


    this.parrellePositionGroup = this.physics.add.staticGroup();

    for(let i=0; i<3; i++){
      createItem.call(this, this.parrellePositionGroup, 200+75*i, 900, 'logo');
    }

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
    

    const agent1 = new Agent(this, 0, 50, 'player', 'misa-front', 'Alice');
    const agent2 = new Agent(this, 450, 1050, 'player', 'misa-front', 'Bob');
    const agent3 = new Agent(this, 300, 950, 'player', 'misa-front', 'Cathy');

    this.agentGroup.add(agent1);
    this.agentGroup.add(agent2);
    this.agentGroup.add(agent3);

    this.controllableCharacters.push(agent1);
    this.controllableCharacters.push(agent2);
    this.controllableCharacters.push(agent3);

    this.agentList.push(agent1, agent2, agent3);
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

    this.physics.add.overlap(

      this.agentGroup,
      this.parrellePositionGroup,
      (agent, item) => {
        if (!overlappedItems.has(item)) {
          overlappedItems.add(item);
          this.events.emit('overlapstart', agent, item);
        }

        if (overlappedItems.size === 3 && !isDebate) {
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
            .text(35, 320, 'Choose Pattern', {
              fontSize: '10px',
              color: '#ffffff',
              wordWrap: { width: 50, useAdvancedWrap: true },
            })
            .setScrollFactor(0)
            .setDepth(1002);
          debateStartBtn.on('pointerdown', (pointer: any) => {
            console.log('start!!');
            if (this.mssgMenu) {
              console.log('Destroying mssgMenu');
              this.mssgMenu.destroy();
              this.mssgMenuText?.destroy();
              this.mssgMenu = null;
              this.mssgMenuText = null;
              this.mssgGroup.clear(true, true);
            } else {
              console.log('Creating mssgMenu');
              this.mssgMenu = this.add
                .rectangle(300, 300, 350, 125, 0x000000)
                .setDepth(1001)
                .setStrokeStyle(2, 0xffffff)
                .setScrollFactor(0)
                .setAlpha(0.5);
      
              this.mssgGroup = this.add.group();

              let patterns = ["chain", "parallel", "route"];
      
              for (let i = 0; i < patterns.length; i++) {
                const mssgBox = this.add
                  .rectangle(300 - 140 + i * 75, 290, 50, 50, 0x000000)
                  .setScrollFactor(0)
                  .setDepth(1003)
                  .setAlpha(0.5);
      
                const mssgLabel = this.add
                  .text(300 - 140 + i * 75 - 15, 280, patterns[i], {
                    fontSize: '10px',
                    color: '#ffffff',
                  })
                  .setScrollFactor(0)
                  .setDepth(1004);
      
                mssgBox.setInteractive({ useHandCursor: true });

                mssgBox.on('pointerdown', (pointer: any) => {
                  let result = null;
                  console.log(patterns[i]);

                  // if(patterns[i] === "parallel") {
                  //   result = await testParallelCustomerSupport();
                  // } else if(patterns[i] === "chain") {
                  //   result = await testChainCustomerSupport();
                  // } else if(patterns[i] === "route") {
                  //   result = await testRoute();
                  // }

                  result = this.choosePattern(patterns[i]);

                  console.log("MAS produced results", result);
                });

                mssgBox.on('pointerover', (pointer: Phaser.Input.Pointer) => {
                  const worldPoint = this.cameras.main.getWorldPoint(
                    pointer.x,
                    pointer.y,
                  );
      
                  if (!this.subMssg) {
                    this.subMssgText = this.add
                      .text(worldPoint.x, worldPoint.y, patterns[i], {
                        fontSize: '10px',
                        color: '#ffffff',
                        wordWrap: { width: 150, useAdvancedWrap: true },
                      })
                      .setDepth(1010)
                      .setScrollFactor(1)
                      .setAlpha(1);
      
                    this.subMssg = this.add
                      .rectangle(
                        worldPoint.x,
                        worldPoint.y,
                        175,
                        this.subMssgText.height + 50,
                        0x000000,
                      )
                      .setDepth(1007)
                      .setStrokeStyle(2, 0xffffff)
                      .setAlpha(1)
                      .setOrigin(0, 0);
      
                    console.log('subMssgText', this.subMssgText, this.subMssg);
                  }
                });
      
                mssgBox.on('pointerout', () => {
                  if (this.subMssg) {
                    this.subMssg.destroy();
                    this.subMssgText?.destroy();
                    this.subMssg = null;
                    this.subMssgText = null;
                  }
                });
      
                this.mssgGroup.add(mssgBox);
                this.mssgGroup.add(mssgLabel);
              }
            }

          });
        }
      },
    );

    this.parrellePositionGroup.on('overlapsend', (item: any, agent: any) => {
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
  }

  private async choosePattern(pattern: string) {
    let result = "";
    if(pattern === "parallel") {
      result = (await testParallelCustomerSupport()).join(', ');
    } else if(pattern=== "chain") {
      result = await testChainCustomerSupport();
    } else if(pattern === "route") {
      result = (await testRoute()).join(', ');
      console.log("route result", result);
    }
    console.log("MAS produced results - inside function", result);
  await new Promise((resolve) => {
    render(
        <Typewriter
            text={result}
            onEnd={() => {
                state.isTypewriting = false;
                resolve(null); // Resolves the promise when Typewriter completes
            }}
        />,
        this,
    );
});

// Step 3: Call Evaluator Function AFTER Typewriter finishes
const evaluation = await evaluateCustomerSupportResponse(pattern, result);
console.log("Evaluator Feedback:", evaluation);

// Step 4: Render Evaluator's Feedback and WAIT until it's finished
await new Promise((resolve) => {
    render(
        <Typewriter
            text={`Evaluator Feedback:\n${evaluation}`}
            onEnd={() => {
                state.isTypewriting = false;
                resolve(null); // Resolves the promise when second Typewriter completes
            }}
        />,
        this,
    );
});

return result;
}

  private getAllAgentPositions() {
    return this.agentGroup.getChildren().map((agent:any) => ({
        name: agent.name,  
        x: agent.x,        
        y: agent.y,        
    }));
}

private moveBirdToNextAgent(bird: Phaser.Physics.Arcade.Sprite, birdSpeed: number, currentTargetIndex: number) {
  if (this.agentList.length === 0) return;

  this.isBirdMoving = true;  

  const targetAgent = this.agentList[currentTargetIndex];
  this.physics.moveToObject(bird, targetAgent, birdSpeed); 

  bird.update = () => {
    if (Phaser.Math.Distance.Between(bird.x, bird.y, targetAgent.x, targetAgent.y) < 5) {
      bird.setVelocity(0, 0); 
      this.isBirdMoving = false;    

      this.agentIndex = (this.agentIndex + 1) % this.agentList.length; 

      this.time.delayedCall(1000, () => {
        this.moveBirdToNextAgent(bird, birdSpeed, this.agentIndex); 
      }, [], this);
    }
  };
}

  

  update() {

    // if (!this.isBirdMoving && this.agentList.length > 0) {
    //   this.moveBirdToNextAgent(this.bird, 100, this.agentIndex);
    // }
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
    } else if (
      this.input.keyboard!.checkDown(
        this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
        250,
      )
    ) {
      console.log('Key "2" pressed');
      this.activateIndex = 1;
      this.cameras.main.startFollow(
        this.controllableCharacters[this.activateIndex],
      );
      this.playerControlledAgent =
        this.controllableCharacters[this.activateIndex];
      console.log(
        'switched utils',
        this.playerControlledAgent.getPromptUtils(),
      );
      this.controllableCharacters.forEach((agent: any) => {
        agent.changeNameTagColor('#ffffff');
      });
      this.playerControlledAgent.changeNameTagColor('#ff0000');
    } else if (
      this.input.keyboard!.checkDown(
        this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
        250,
      )
    ) {
      console.log('Key "3" pressed');
      this.activateIndex = 2;
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
      this.scene.start('level1');
    } else if(this.cursors.eight.isDown) {
      // this.scene.start('level2');
    } else if(this.cursors.nine.isDown) {
      this.scene.start('Main');
    }
  }
}
