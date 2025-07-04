import Phaser from 'phaser';
import { render } from 'phaser-jsx';

import {baseballGroundTruth, kidneyGroundTruth} from '../../const'

import { Typewriter } from '../components';
import {
  key,
} from '../constants';
import { state } from '../state';
import { NPC } from '../sprites/NPC';
import { Agent } from '../sprites/Agent';
import { controlCameraMovements } from '../utils/controlUtils';
import { addAgentPanelHUD, addTaskAssignmentHUD} from '../utils/hudUtils';
import { areAllZonesOccupied, createItem, getAllAgents, setupScene, setZonesCollisionDetection, setZonesExitingDecoration } from '../utils/sceneUtils';
import { debate } from '../server/llmUtils';
import { ParentScene } from './ParentScene';
import { evaluateCustomerSupportResponse, eventTargetBus, testChainCustomerSupport, testParallelCustomerSupport, testRoute } from '../server/testingUtils';
import { constructLangGraph, constructSequentialGraph, transformDataMap } from '../../langgraph/chainingUtils';
import { testInput, resetReportIcons} from '../../langgraph/agents';
import { constructVotingGraph, votingExample } from '../../langgraph/votingUtils';
import { constructRouteGraph } from '../../langgraph/routeUtils';
import { restart, sequential } from '../assets/sprites';
import { randomAssignTopic } from '../../utils/sceneUtils';
import { constructSingleAgentGraph } from '../../langgraph/singleAgentUtils';
import { createScoreUI, resetScoreUI } from '../../langgraph/workflowUtils';
// import { minogramPng, minogramXml } from '../../../public/assets/bitmapFont';

// import { createGenerateVisualizationButton } from '../../langgraph/visualizationGenerate';



export interface Zone {
  zone: Phaser.GameObjects.Zone;
  zoneName: string;
  agentsInside: Set<string>;
}

export class Level2 extends ParentScene {

  private parrellePositionGroup!: Phaser.Physics.Arcade.StaticGroup;
  private agentList: Map<string, Agent> = new Map();
  
  private parallelZones: Zone[] = [];
  private chainingZones: Zone[] = [];
  private votingZones: Zone[] = [];
  private routeZones: Zone[] = [];

  private zones: any[] = [];

  private isWorkflowAvailable: boolean = false;

  private startWorkflowBtn!: Phaser.GameObjects.Rectangle;
  private startWorkflowLabel!: Phaser.GameObjects.Text;

  private debateStartBtn!: Phaser.GameObjects.Image;
  private debateStartLabel!: Phaser.GameObjects.Text;

  private roomStatusTexts: Phaser.GameObjects.Text[] = [];

  private zoneBackgrounds: Phaser.GameObjects.Rectangle[] = [];

  private reportBtn!: Phaser.GameObjects.Image;

  private routeStartBtn!: Phaser.GameObjects.Rectangle;
  private restartBtn!: Phaser.GameObjects.Image;
  private routeStartLabel!: Phaser.GameObjects.Text;
  private baseBallBtn!: Phaser.GameObjects.Image;
  private kidneyBtn!: Phaser.GameObjects.Image;

  private votingStartBtn!: Phaser.GameObjects.Rectangle;
  private votingStartLabel!: Phaser.GameObjects.Text;

  private hudElements: Phaser.GameObjects.GameObject[] = []; // Store all HUD elements

  private isCameraFollowing: boolean = false; 

  private debugGraphics!: Phaser.GameObjects.Graphics;
  private hoverWindow?: Phaser.GameObjects.Rectangle;
  private hoverWindowText?: Phaser.GameObjects.Text;
  private selectedText?: Phaser.GameObjects.Text;
  private selectedDataset: string = "none";

private attachInfoIcon(
  target: Phaser.GameObjects.Image,
  imageKey: string,
  offsetX = 35,
  offsetY = -20
) {
  const icon = this.add.text(
    target.x + offsetX,
    target.y + offsetY,
    '🛈',
    {
      fontSize: '25px',
      color: '#ffffff',
      // backgroundColor: '#0000ff',
      fontStyle: 'normal',
      padding: { x: 8, y: 6 },
      fontFamily: 'Verdana',
    }
  )
  .setScrollFactor(0)
  .setDepth(9999)
  .setOrigin(0.5)
  .setResolution(2)
  .setInteractive();

  // console.log(
  //   `🧷 Info icon attached to ${target.texture.key} at (${icon.x}, ${icon.y})`
  // );

icon.on('pointerover', (pointer: Phaser.Input.Pointer) => {
  const hoverWindowX = pointer.x + 230;
  const hoverWindowY = pointer.y - 20;

  if (!this.hoverWindow) {
    const hoverText = this.getInfoText(imageKey);

    // Step 1: Create the text and hide it first
    this.hoverWindowText = this.add.text(
      hoverWindowX,
      hoverWindowY,
      hoverText,
      {
        fontFamily: 'Verdana',
        fontSize: '16px',
        color: '#ffffff',
        wordWrap: { width: 500 },
      }
    )
    .setScrollFactor(0)
    .setDepth(1012)
    .setAlpha(1)
    .setVisible(false)
    .setOrigin(0.5, 0.5)
    .setResolution(2);


    // Step 2: Getting the text size
    const bounds = this.hoverWindowText.getBounds();
    const padding = 20;

    // Step 3: Adding a Background
    this.hoverWindow = this.add.rectangle(
      hoverWindowX,
      hoverWindowY,
      bounds.width + padding,
      bounds.height + padding,
      0x000000
    )
    .setScrollFactor(0)
    .setDepth(1011)
    .setAlpha(0.9)
    .setStrokeStyle(2, 0xffffff);

    // Step 4: Displaying Text
    this.hoverWindowText.setVisible(true);
  }
});

  icon.on('pointerout', () => {
    this.hoverWindow?.destroy();
    this.hoverWindowText?.destroy();
    this.hoverWindow = undefined;
    this.hoverWindowText = undefined;
  });
}



// helper method: returns the corresponding message text based on the imageKey
private getInfoText(imageKey: string): string {
  switch(imageKey) {
    case 'baseball_groundtruth':
      return baseballGroundTruth;
    case 'kidney_groundtruth':
      return kidneyGroundTruth;
    default:
      return 'Dataset Info';
  }
}

// private attachInfoIcon(
//   target: Phaser.GameObjects.Image,
//   imageKey: string,
//   offsetX = 35,
//   offsetY = -35
// ) {
//   const x = target.x + offsetX;
//   const y = target.y + offsetY;

//   const circle = this.add.circle(0, 0, 16, 0xcccccc)
//     .setScrollFactor(0);

//   const text = this.add.text(0, 0, 'i', {
//     fontSize: '18px',
//     color: '#000000',
//     fontFamily: 'Verdana',
//   })
//     .setOrigin(0.5)
//     .setScrollFactor(0);

//   const icon = this.add.container(x, y, [circle, text])
//     .setSize(32, 32)
//     .setInteractive(
//       new Phaser.Geom.Rectangle(-16, -16, 32, 32),
//       Phaser.Geom.Rectangle.Contains
//     )
//     .setScrollFactor(0)
//     .setDepth(10000);

//   console.log(`Info icon attached to ${target.texture.key} at (${icon.x}, ${icon.y})`);
//   console.log(`Target button depth: ${target.depth}, Icon depth: ${icon.depth}`);

//   icon.on('pointerover', (pointer: Phaser.Input.Pointer) => {
//     const hoverWindowX = pointer.x + 20;
//     const hoverWindowY = pointer.y - 20;

//     if (!this.hoverWindow) {
//       this.hoverWindow = this.add.rectangle(
//         hoverWindowX,
//         hoverWindowY,
//         135,
//         50,
//         0x000000
//       )
//         .setScrollFactor(0)
//         .setDepth(10001)
//         .setAlpha(0.9)
//         .setStrokeStyle(2, 0xffffff);

//       this.hoverWindowText = this.add.text(
//         hoverWindowX,
//         hoverWindowY,
//         this.getInfoText(imageKey)
//       )
//         .setScrollFactor(0)
//         .setDepth(10002)
//         .setAlpha(1)
//         .setOrigin(0.5, 0.5)
//         .setStyle({
//           fontFamily: 'Verdana',
//           fontSize: '12px',
//           color: '#ffffff',
//         });
//     }
//   });

//   icon.on('pointerout', () => {
//     this.hoverWindow?.destroy();
//     this.hoverWindowText?.destroy();
//     this.hoverWindow = undefined;
//     this.hoverWindowText = undefined;
//   });

//   return icon;
// }


  constructor() {
    super("level2");
    this.sceneName = "";
    eventTargetBus.addEventListener("signal", (event:any) => {
      console.log(`Level2 received: ${event.detail}`);
      if (event.detail === "signal 1") {
        console.log("Research phase completed.");
      } else if (event.detail === "signal 2") {
        console.log("News article formatting completed.");
      }
    });
  }

  create() {

    //this.load.bitmapFont('myFont', '/assets/bitmapFont/minogramFont.png', '/assets/bitmapFont/minogramFont.xml');

    // for testing
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.leftButtonDown()) {
            console.log(`Mouse clicked at: x=${pointer.worldX}, y=${pointer.worldY}`);
        }
    });

    // Initialize the HUD array
    this.hudElements = [];

     // reset button
  const resetButton = this.add.text(20, 20, '⟳ Reset', {
    fontSize: '18px',
    fontFamily: 'Verdana',
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: { x: 10, y: 5 },
  })
  .setOrigin(0, 0)
  .setDepth(2000)
  .setScrollFactor(0)
  .setInteractive();

  resetButton.on('pointerdown', () => {
    window.location.reload();
  });

    

    setupScene.call(this, "office");

    // register a global variable
    this.registry.set('isWorkflowRunning', false);
    // register a global variable for pattern choosing
    // currentPattern === "" -> no pattern is chosen
    this.registry.set('currentPattern', "");
    this.registry.set('currentDataset', 'baseball');
    this.registry.set("workflowConfig", ['voting', 'sequential', 'single_agent']);

    console.log("isWorkflowRunning", this.registry.get('isWorkflowRunning'));

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
    
    //set the camera
    this.isCameraFollowing = false;

    // this.cameras.main.startFollow(this.controllableCharacters[0]);

    // 1 second to unfollow the camera, allowing the player to move freely.
    this.time.delayedCall(1, () => {
      this.cameras.main.stopFollow();
    }, [], this);

   //  this.controllableCharacters[0].changeNameTagColor('#ff0000');

    this.physics.add.overlap(
      this.agentGroup,
      this.npc,
      this.onPlayerNearNPC,
      undefined,
      this,
    );

    // collision logics  
    setZonesCollisionDetection(this, this.parallelZones, this.agentGroup);
    setZonesCollisionDetection(this, this.votingZones, this.agentGroup);
    setZonesCollisionDetection(this, this.chainingZones, this.agentGroup);
    setZonesCollisionDetection(this, this.routeZones, this.agentGroup);

   // render(<TilemapDebug tilemapLayer={this.worldLayer} />, this);

    // const squareSize = 50;
    // const spacing = 20;
    // const startX = 75;
    // const startY = 520;
    // addAgentPanelHUD.call(this, startX, startY, squareSize, spacing);

    // add controls UI
    this.agentControlButtons = this.add.group();
    this.agentControlButtonLabels = [];

    // addTaskAssignmentHUD.call(this);
    this.overlappedItems = new Set();
    let overlappedItems = new Set();
    let isDebate = false;
    let debateStartBtn = null;
    let restartBtn = null;
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
          // debateStartBtn = this.add
          //   .image(50, 330, 'start')
          //   .setScrollFactor(0)
          //   .setDepth(1001)
          //   .setInteractive();

          // restartBtn = this.add
          //   .image(50, 400, 'restart')
          //   .setScrollFactor(0)
          //   .setDepth(1001)
          //   .setInteractive()

          console.log("debateStartBtn", debateStartBtn, restartBtn);

            //const creditsIcon = this.add.image(570, 35, 'coinIcon') 
  //   .setOrigin(1, 0.5) 
  //   .setScrollFactor(0)
  //   .setDepth(1000);

          // debateStartLabel = this.add
          //   .text(35, 320, 'Start Debate', {
          //     fontSize: '10px',
          //     color: '#ffffff',
          //     wordWrap: { width: 50, useAdvancedWrap: true },
          //   })
          //   .setScrollFactor(0)
          //   .setDepth(1002);
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

// createBuildRoomButton(this);
// createGenerateVisualizationButton(this);

// this.worldLayer.setCollisionByProperty({ collides: true });

// this.debugGraphics = this.add.graphics().setAlpha(0.7);
// this.worldLayer.renderDebug(this.debugGraphics, {
//   tileColor: null,
//   collidingTileColor: new Phaser.Display.Color(255, 0, 0, 255),
//   faceColor: new Phaser.Display.Color(0, 255, 0, 255)
// });



    state.isTypewriting = true;
    // render(
    //   <Typewriter
    //     text="WASD or arrow keys to move, space to interact; 1, 2, and 3 to switch agents."
    //     onEnd={() => (state.isTypewriting = false)}
    //   />,
    //   this,
    // );

    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.pause(key.scene.main);
      this.scene.launch(key.scene.menu);
    });

    for(let i=0; i<this.parallelZones.length; i++) {

    }

    if(this.parallelZones){

    }


  // 获取 tilemap 的尺寸
  const mapWidth = this.tilemap.widthInPixels;
  const mapHeight = this.tilemap.heightInPixels;

  // 获取画布的尺寸
  const canvasWidth = this.scale.width;
  const canvasHeight = this.scale.height;

  // 计算缩放比例
  const zoomX = canvasWidth / mapWidth;
  const zoomY = canvasHeight / mapHeight;
  const zoom = Math.min(zoomX, zoomY);

  // 设置摄像头缩放和中心
  this.cameras.main.setZoom(zoom);
  this.cameras.main.centerOn(mapWidth / 2, mapHeight / 2);

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

  update() {
    setZonesExitingDecoration(this.parallelZones, this.agentGroup);
    setZonesExitingDecoration(this.votingZones, this.agentGroup);
    setZonesExitingDecoration(this.chainingZones, this.agentGroup);
    setZonesExitingDecoration(this.routeZones, this.agentGroup);

    // this.load.bitmapFont('myFont', minogramPng, minogramXml);

  if(
    (areAllZonesOccupied(this.parallelZones)
     && !this.isWorkflowAvailable
     && !this.registry.get('isWorkflowRunning')
    )
  ) {
    this.registry.set('currentPattern', 'parallel');
    this.isWorkflowAvailable = true;
    console.log("All zones are occupied!");
    // create a start workflow button
    this.debateStartBtn = this.add
    .image(0, 330, 'start')
    .setScrollFactor(0)
    .setDepth(1010)
    .setInteractive()
    .setAlpha(1)
    .setScale(1.5); // Increase the size of the image by scaling it

    this.baseBallBtn = this.add
    .image(0, 425, 'baseball')
    .setScrollFactor(0)
    .setDepth(1010)
    .setInteractive()
    .setAlpha(1)
    .setScale(1.5)
    .on("pointerover", (pointer:any)=>{
      console.log("pointer over");

      const hoverWindowX = pointer.x + 50
      const hoverWindowY = pointer.y + 50

      if(!this.hoverWindow){
      this.hoverWindow = this
        .add
        .rectangle(hoverWindowX, hoverWindowY, 135, 50, 0x000000)
        .setScrollFactor(0)
        .setDepth(1011)
        .setAlpha(1)
        .setStrokeStyle(2, 0xffffff);
      this.hoverWindowText = this.add.text(hoverWindowX, hoverWindowY, "Baseball Player\nDataset")
      .setScrollFactor(0)
      .setDepth(1012)
      .setAlpha(1)
      .setFontSize(14)
      .setColor('#ffffff')
      .setOrigin(0.5, 0.5)  
      .setStyle({ fontFamily: 'Verdana', fontSize: '14px', color: '#ffffff' });
      }

  })
  .on("pointerout", ()=>{
    console.log("pointer out");
    if(this.hoverWindow){
      this.hoverWindow.destroy();
      this.hoverWindowText?.destroy();
      this.hoverWindow = undefined;
      this.hoverWindowText = undefined;
    }
  })
  .on("pointerdown", ()=>{
    if(this.selectedDataset !== 'baseball'){
      this.selectedDataset = "baseball";
      this.selectedText?.destroy();
      this.kidneyBtn.setDepth(1010);
    this.selectedText = this.add.text(0, 425, "SELECTED")
    .setScrollFactor(0)
    .setDepth(1012)
    .setAlpha(1)
    // .setFontSize(12.5)
    // .setColor('#ffffff')
    .setStyle({ fontFamily: 'Verdana', fontSize: '14px', color: '#ffffff' })
    .setLetterSpacing(2)
    .setResolution(20)
    .setOrigin(0.5, 0.5)
    .setStroke('#ebebec', 2)
    .disableInteractive();
    this.baseBallBtn.setDepth(998);
    this.registry.set('currentDataset', 'baseball');

    } else {
      this.selectedDataset = "none";
      this.selectedText?.destroy();
      this.baseBallBtn.setDepth(1010);
      
    }
  });
    console.log("ready to attach info icon for baseball");
    this.attachInfoIcon(this.baseBallBtn, 'baseball_groundtruth');
    

  this.add.text(0, 280, 'Start\nSimulation')
  .setScrollFactor(0)
  .setDepth(1002)
  .setAlpha(1)
  .setFontSize(20)
  .setStyle({ fontFamily: 'Verdana', fontSize: '14px', color: '#ffffff' })
  .setLetterSpacing(2)
  .setResolution(2)
  .setOrigin(0.5, 0.5);

      this.add.text(0, 375, 'Choose\nA Dataset')
      .setScrollFactor(0)
      .setDepth(1002)
      .setAlpha(1)
      .setFontSize(13) // Increased font size
      .setStyle({ fontFamily: 'Verdana', fontSize: '14px', color: '#ffffff' })
      .setLetterSpacing(2)
      .setResolution(20)
      .setStroke('#000000', 2)
      .setOrigin(0.5, 0.5);
    this.add.rectangle(0, 400, 100, 290, 0x000000).setScrollFactor(0).setDepth(999).setAlpha(0.5).setStrokeStyle(2, 0xffffff).disableInteractive();
    
    this.kidneyBtn = this.add
    .image(0, 485, 'kidney')
    .setScrollFactor(0)
    .setDepth(1010)
    .setInteractive()
    .setAlpha(1)
    .setScale(1.5)
    .on("pointerover", (pointer:any)=>{
        console.log("pointer over");
        const hoverWindowX = pointer.x + 50
        const hoverWindowY = pointer.y + 50

        if(!this.hoverWindow){
        this.hoverWindow = this
          .add
          .rectangle(hoverWindowX, hoverWindowY, 135, 50, 0x000000)
          .setScrollFactor(0)
          .setDepth(1011)
          .setAlpha(1)
          .setStrokeStyle(2, 0xffffff);
        this.hoverWindowText = this.add.text(hoverWindowX, hoverWindowY, "Kidney Treatments\nDataset")
        .setScrollFactor(0)
        .setDepth(1012)
        .setAlpha(1)
        .setFontSize(12.5)
        .setColor('#ffffff')
        .setStyle({ fontFamily: 'Verdana', fontSize: '14px', color: '#ffffff' })
        .setOrigin(0.5, 0.5);
          
      }


    })
    .on("pointerout", ()=>{
      console.log("pointer out");
      if(this.hoverWindow){
        this.hoverWindow.destroy();
        this.hoverWindowText?.destroy();
        this.hoverWindow = undefined;
        this.hoverWindowText = undefined;
      }
    })
    .on("pointerdown", ()=>{
      if(this.selectedDataset !== 'kidney'){
        this.selectedDataset = "kidney";
        this.selectedText?.destroy();
        this.baseBallBtn.setDepth(1010);
      this.selectedText = this.add.text(0, 485, "SELECTED")
      .setScrollFactor(0)
      .setDepth(1012)
      .setAlpha(1)
      .setFontSize(12.5)
      .setStroke('#000000', 2)
      // .setColor('#ffffff')
      .setStyle({ fontFamily: 'Verdana', fontSize: '14px', color: '#ffffff' })
      .setLetterSpacing(2)
      .setResolution(20)
      .setOrigin(0.5, 0.5)
      .disableInteractive();
      this.kidneyBtn.setDepth(998);
      this.registry.set('currentDataset', 'kidney');

      } else {
        this.selectedDataset = "none";
        this.selectedText?.destroy();
        this.kidneyBtn.setDepth(1010);
        
      }
    });
    console.log("ready to attach info icon for kidney");

    this.attachInfoIcon(this.kidneyBtn, 'kidney_groundtruth');

    this.debateStartBtn.on('pointerdown', async () => {
    
    // Reset old UIs(ReportUI and ScoresUI)
    resetReportIcons(this);
    resetScoreUI(this);


      this.registry.set('isWorkflowRunning', true);
      console.log("btn pre-start zones data", this.parallelZones);
       const agentsInfo = getAllAgents(this.parallelZones);
       console.log("agentsInfo", agentsInfo);
       
       const agentName1 = agentsInfo[0].agents[0];
        const agentName2 = agentsInfo[1].agents[0];

        const agent1 = this.agentList.get(agentName1);
        const agent2 = this.agentList.get(agentName2);

        console.log("agent1", agent1, agent1?.x, agent1?.y);
        console.log("agent2", agent2, agent2?.x, agent2?.y);

        console.log("btn start zones data", this.parallelZones);

        const topic = randomAssignTopic();

        const datamap = transformDataMap(this.votingZones, this.controllableCharacters);
        const datamap2 = transformDataMap(this.parallelZones, this.controllableCharacters);
        const datamap3 = transformDataMap(this.routeZones, this.controllableCharacters);

        // set all positions here: 
        const reportEndingPosition = {x: 900, y: 320};
        const votingEndingPosition = {x: 275, y: 350};
        const chainingEndingPosition = {x: 520, y: 350};
        const routingEndingPosition = {x: 770, y: 330};

        const allPositions = [votingEndingPosition, chainingEndingPosition, routingEndingPosition, reportEndingPosition];

        let workflowConfig = this.registry.get("workflowConfig");
        const datamaps = [datamap, datamap2, datamap3];
        // TEST: if workflowConfig has different parameters
        // workflowConfig = ['sequential', 'single_agent', 'voting'];
        
        console.log("init workflowConfig", workflowConfig);

        // Initialize graphs array
        let graphs: any[] = [];
        // Initialize agent prompts
        let agentPrompts: any[] = ["1", "2", "3"];

        for( let i=0; i<workflowConfig.length; i++){
          // fetching movement positions
          const firstPosition = allPositions[i];
          const secondPosition = allPositions[i+1];

          // fetching agents from datamaps - index-1 room need special handling
          let agentsParameter = null;
          if(i!=1){
            agentsParameter = datamaps[i][0].agents;
          } else{
            const datamap = datamaps[i];
            // tranform the datamap to get the agents
            console.log("datamap2", datamap);
            agentsParameter = datamap.map((zone: any) => {
              console.log("datamap zone", zone);
              return zone.agents[0];
            });

          }
          console.log("agentsParameter", i, agentsParameter);
          // fetching agent prompts
          console.log("agent prompts", agentPrompts[i]);
          // Insert prompts into the graphs below:
          if(workflowConfig[i] === "voting"){
            console.log("construct voting graph");
            const graph = constructVotingGraph(agentsParameter, this, this.tilemap, firstPosition, secondPosition, i);
            graphs.push(graph);
          } else if(workflowConfig[i] === "sequential") {
            console.log("construct sequential graph");
            const graph = constructSequentialGraph(agentsParameter, this, this.tilemap, firstPosition, secondPosition, i);
            graphs.push(graph);
          } else if(workflowConfig[i] === "single_agent") {
            console.log("construct single agent graph");
            const graph = constructSingleAgentGraph(agentsParameter, this, this.tilemap, firstPosition, secondPosition, i);
            graphs.push(graph);
          }
        }

        let firstOutput:any = null;
        let secondOutput:any = null;
        let finalOutput:any = null;

        let cycleOutputs:any[] = [votingExample];

        let scoreData = null;


        // we need unified interface for all graphs, ok... some weird combinatoric manipulation here....
        for(let i=0; i<graphs.length; i++){
          if(workflowConfig[i] === "voting"){
            console.log("invoke voting graph");
            let output = await graphs[i].invoke({votingInput: cycleOutputs[0], votingVotes: []});
            cycleOutputs.push(output.votingOutput);
            if(i === graphs.length - 1) {
              scoreData = output.scoreData;
            }
          } else if(workflowConfig[i] === "sequential") {
            console.log("invoke lang graph");
            let output = await graphs[i].invoke({sequentialInput: cycleOutputs[i]});
            cycleOutputs.push(output.sequentialOutput);
            if(i === graphs.length - 1) {
              scoreData = output.scoreData;
            }
          } else if(workflowConfig[i] === "single_agent") {
            console.log("invoke routing graph");
            let output = await graphs[i].invoke({singleAgentInput: cycleOutputs[i]});
            cycleOutputs.push(output.singleAgentOutput);
            if(i === graphs.length - 1) {
              scoreData = output.scoreData;
            }
          }
        }

        console.log("scoreData", scoreData);

        createScoreUI(
          this, 
          600, 
          20, 
          scoreData.overall_score, 
          scoreData.writing_score, 
          scoreData.coding_score,
          scoreData.writing_reasons,
          scoreData.coding_reasons
        );
      

        console.log("first output", firstOutput);
        console.log("finalDecision", secondOutput);
        console.log("finalDecision2", finalOutput);

        eventTargetBus.dispatchEvent(new CustomEvent("signal", { detail: "special signal!!!" }));
    });
  } 


  if(
    this.registry.get('isWorkflowRunning')===false
    &&!areAllZonesOccupied(this.parallelZones)
    &&!areAllZonesOccupied(this.votingZones)
    &&!areAllZonesOccupied(this.routeZones)
  ){
    this.registry.set('currentPattern', "");
    this.isWorkflowAvailable = false;
    if(this.debateStartBtn){
      this.debateStartBtn.destroy();
      this.debateStartLabel.destroy();
    }
  }


    this.playerControlledAgent =
      this.controllableCharacters[this.activateIndex];

    // for (let i = 0; i < 3; i++) {
    //   if (i < this.playerControlledAgent.getPromptUtils().length) {
    //     this.promptTexts[i].setText(
    //       this.playerControlledAgent.getPromptUtils()[i],
    //     );
    //   } else {
    //     this.promptTexts[i].setText('empty');
    //   }
    // }

    this.controllableCharacters.forEach((agent: any) => {
      agent.update();
    });

    // this.hudText.setText(
    //   `${this.controllableCharacters[this.activateIndex].getName()}(Player-controlled) `,
    // );

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

      // Setting the camera to follow the character
      this.cameras.main.startFollow(this.playerControlledAgent);
      this.isCameraFollowing = true;  // Update camera status
      console.log(`📷 Now follow the agent:${this.playerControlledAgent.getName()}`);
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

      // Setting the camera to follow the agent
      this.cameras.main.startFollow(this.playerControlledAgent);
      this.isCameraFollowing = true;  // Update camera status
      // console.log(`📷 Now follow the agent: ${this.playerControlledAgent.getName()}`);
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

      // Setting the camera to follow the agent
      this.cameras.main.startFollow(this.playerControlledAgent);
      this.isCameraFollowing = true;  // Update camera status
      // console.log(`📷 Now follow the agent: ${this.playerControlledAgent.getName()}`);
    }

    /* Control Aengent */

    // controlAgentMovements(this.playerControlledAgent, this.cursors);
    // controlAgentWithMouse(this, this.playerControlledAgent, this.tilemap, 
    //   (pointer) => isClickOnHUD(pointer, this.hudElements) // Pass in the HUD array
    // );


    /* Control Camera by WASD */

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
      this.scene.start('level1');
    } else if(this.cursors.eight.isDown) {
      // this.scene.start('level2');
    } else if(this.cursors.nine.isDown) {
      this.scene.start('Main');
    }
  }

  private updateWorkflowButtonEvent(eventName: string, newEvent: any){
    this.startWorkflowBtn.off("pointerdown");
    this.startWorkflowBtn.on("pointerdown", newEvent);
    this.startWorkflowLabel.setText(eventName);
  }

  // Ensure this code is inside the `create` method after initializing `this.baseBallBtn`

}
