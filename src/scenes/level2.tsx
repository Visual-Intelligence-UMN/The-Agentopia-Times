import Phaser from 'phaser';
import { Rectangle, render } from 'phaser-jsx';

import { Button, TilemapDebug, Typewriter } from '../components';
import {
  Depth,
  key,
  TilemapLayer,
  TilemapObject,
  TILESET_NAME,
} from '../constants';
import { Player } from '../sprites';
import { state } from '../state';
import { NPC } from '../sprites/NPC';
import { Agent } from '../sprites/Agent';
import { fetchChatCompletion } from '../server/server';
import { HUDScene } from './HUD';
import { TextInput } from '../components/TextInput';
import { TextField } from '@mui/material';
import { Inventory } from '../components/Inventory';
import { Velocity } from '../sprites';
import { Animation } from '../sprites';
import * as ts from 'typescript';
import { controlAgentMovements, initKeyboardInputs } from '../utils/controlUtils';
import { controlPlayerPerspective } from '../utils/controlUtils';
import { setupKeyListeners } from '../utils/controlUtils';
import { AgentPerspectiveKeyMapping } from '../utils/controlUtils';
import { addAgentPanelHUD, addAgentSelectionMenuHUD, addSceneNameHUD } from '../utils/hudUtils';
import { createItem } from '../utils/sceneUtils';
import { debateWithJudging } from '../server/simulations/debate';

interface Sign extends Phaser.Physics.Arcade.StaticBody {
  text?: string;
}

interface MessageRecord {
  system: string;
  user: string;
  gpt: string;
}

export class Level2 extends Phaser.Scene {
  private player!: Player;
  private sign!: Sign;
  private tilemap!: Phaser.Tilemaps.Tilemap;
  private worldLayer!: Phaser.Tilemaps.TilemapLayer;
  private itemGroup!: Phaser.Physics.Arcade.StaticGroup;
  private deductiveItem!: Phaser.Physics.Arcade.StaticGroup;
  private itemText!: Phaser.GameObjects.Text;
  private npc!: Phaser.Physics.Arcade.Sprite;
  private deductiveItemText!: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private promptTexts: Phaser.GameObjects.Text[] = [];
  private mssgData: MessageRecord[] = [];
  private mssgMenu: Phaser.GameObjects.Rectangle | null = null;
  private mssgMenuText: Phaser.GameObjects.Text | null = null;
  private mssgGroup!: Phaser.GameObjects.Group;
  private subMssg: Phaser.GameObjects.Rectangle | null = null;
  private subMssgText: Phaser.GameObjects.Text | null = null;
  private controllableCharacters: any[] = [];
  private activateIndex: number = 0;
  private playerControlledAgent!: Agent;
  private cursors!: any;
  private controlMapping!: AgentPerspectiveKeyMapping[];
  private keyMap!: any;
  private agentControlButtons!: Phaser.GameObjects.Group;

  private agentGroup!: any;
  private agentControlButtonLabels: Phaser.GameObjects.Text[] = [];
  private overlappedItems: Set<any> = new Set();
  private debatePositionGroup!: Phaser.Physics.Arcade.StaticGroup;
  private isDebate: boolean = false;

  private sceneName: string = "Game: Level 2"

  private testnpc!: Phaser.Physics.Arcade.Sprite;

  constructor() {
    super({key: "level2"});
  }

  create() {
    //TESTING: run TS in runtime
    const testCode = `console.log("hello world")`;
    const jsCode = ts.transpile(testCode);
    eval(jsCode);

    this.agentGroup = this.physics.add.group();

    addSceneNameHUD.call(this);

    //add player to controllableCharacters
    this.cursors = initKeyboardInputs.call(this);
    //add player to controllableCharacters

    // dummy history data
    // for(let i = 0; i < 2; i++) {
    //   this.mssgData.push({
    //     system: "system message",
    //     user: "user message",
    //     gpt: "Parameters are the name you gave the tileset in Tiled and"
    //   });
    // }
    this.tilemap = this.make.tilemap({ key: key.tilemap.tuxemon });

    // Parameters are the name you gave the tileset in Tiled and
    // the key of the tileset image in Phaser's cache (name used in preload)
    const tileset = this.tilemap.addTilesetImage(
      TILESET_NAME,
      key.image.tuxemon,
    )!;

    // Parameters: layer name (or index) from Tiled, tileset, x, y
    this.tilemap.createLayer(TilemapLayer.BelowPlayer, tileset, 0, 0);
    this.worldLayer = this.tilemap.createLayer(
      TilemapLayer.World,
      tileset,
      0,
      0,
    )!;
    const aboveLayer = this.tilemap.createLayer(
      TilemapLayer.AbovePlayer,
      tileset,
      0,
      0,
    )!;

    this.worldLayer.setCollisionByProperty({ collides: true });
    this.physics.world.bounds.width = this.worldLayer.width;
    this.physics.world.bounds.height = this.worldLayer.height;

    // this.scene.launch('HUDScene');

    // this.npc = this.physics.add.sprite(1000, 500, 'npcSprite');
    // this.npc.setImmovable(true);

    // By default, everything gets depth sorted on the screen in the order we created things.
    // We want the "Above Player" layer to sit on top of the player, so we explicitly give it a depth.
    // Higher depths will sit on top of lower depth objects.
    aboveLayer.setDepth(Depth.AbovePlayer);

    // this.addPlayer();

    //TODO: add dynamic animation and text labeling

    this.itemGroup = this.physics.add.staticGroup();
    this.deductiveItem = this.physics.add.staticGroup();
    this.debatePositionGroup = this.physics.add.staticGroup();

    this.itemText = this.add.text(350, 950, 'think step-by-step');
    this.deductiveItemText = this.add.text(450, 1050, 'deductive reasoning');

    this.tweens.add({
      targets: [this.itemText, this.deductiveItemText], // 目标元素
      y: '+=10', // 向下移动 10 像素
      duration: 800, // 持续时间 800 毫秒
      ease: 'Sine.easeInOut', // 使运动更平滑
      yoyo: true, // 反向回到原位置
      repeat: -1, // 无限循环
    });

    // const item1 = this.itemGroup.create(400, 1000, 'logo').setScale(0.25);
    // const item2 = this.deductiveItem.create(500, 1100, 'logo').setScale(0.25);

    // this.physics.world.enable([item1, item2]);

    // const originalWidth = item1.width;
    // const originalHeight = item1.height;
    // const scaleFactor = 0.25;

    // item1.body.setSize(originalWidth * scaleFactor, originalHeight * scaleFactor);
    // item1.body.setOffset(
    //   (originalWidth - originalWidth * scaleFactor) / 2,
    //   (originalHeight - originalHeight * scaleFactor) / 2
    // );

    // item2.body.setSize(originalWidth * scaleFactor, originalHeight * scaleFactor);
    // item2.body.setOffset(
    //   (originalWidth - originalWidth * scaleFactor) / 2,
    //   (originalHeight - originalHeight * scaleFactor) / 2
    // );

    // this.physics.add.overlap(
    //   this.agentGroup,
    //   this.itemGroup,
    //   this.collectItem,
    //   undefined,
    //   this
    // );

    // this.physics.add.overlap(
    //   this.agentGroup,
    //   this.deductiveItem,
    //   this.collectDeductiveReasoning,
    //   undefined,
    //   this
    // );

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

    // this.physics.add.overlap(
    //   this.agentGroup as Phaser.Physics.Arcade.Group,
    //   this.npc as Phaser.Physics.Arcade.Sprite,
    //   this.onPlayerNearNPC,
    //   undefined,
    //   this
    // );

    this.npc = new NPC(this, 600, 900);
    this.physics.add.collider(this.npc, this.worldLayer);

    this.physics.add.collider(this.agentGroup, this.worldLayer);

    //this.testnpc = new NPC(this, 100, 100, "player", "misa-front")

    //this.physics.add.collider(this.testnpc, this.worldLayer);

    const agent1 = new Agent(this, 350, 1200, 'player', 'misa-front', 'Alice');
    const agent2 = new Agent(this, 450, 1050, 'player', 'misa-front', 'Bob');
    const agent3 = new Agent(this, 300, 950, 'player', 'misa-front', 'Cathy');

    this.agentGroup.add(agent1);
    this.agentGroup.add(agent2);
    this.agentGroup.add(agent3);

    this.controllableCharacters.push(agent1);
    this.controllableCharacters.push(agent2);
    this.controllableCharacters.push(agent3);

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

    // Set the bounds of the camera
    this.cameras.main.setBounds(
      0,
      0,
      this.tilemap.widthInPixels,
      this.tilemap.heightInPixels,
    );

    render(<TilemapDebug tilemapLayer={this.worldLayer} />, this);

    const squareSize = 50;
    const spacing = 20;
    const startX = 75;
    const startY = 520;
    addAgentPanelHUD.call(this, startX, startY, squareSize, spacing);

    // let mssgMenu:any = null;

    //render(<Button text="Message" x={25} y={50} />, this);

    const mssgBtn = this.add
      .rectangle(50, 400, 50, 50, 0x000000)
      .setDepth(1002)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive()
      .setScrollFactor(0)
      .setAlpha(0.5);

    const mssgBtnText = this.add
      .text(30, 390, 'History \nMessage', {
        fontSize: '10px',
        color: '#ffffff',
      })
      .setScrollFactor(0)
      .setDepth(1003);

    mssgBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      console.log('mssgBtn clicked');

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

        // let mssgText = "empty";
        // if (this.mssgData.length > 0) {
        //   mssgText = this.mssgData[this.mssgData.length - 1].gpt;
        // }

        // this.mssgMenuText = this.add.text(200, 600, mssgText, { fontSize: '10px', color: '#ffffff' })
        //   .setDepth(1002).setScrollFactor(0);

        this.mssgGroup = this.add.group();

        for (let i = 0; i < this.mssgData.length; i++) {
          const mssg = this.playerControlledAgent.getMemory()[i];
          const mssgText = `${mssg.gpt}`;
          // this.add.text(200, 300 + i * 100, mssgText, { fontSize: '10px', color: '#ffffff' })
          //   .setDepth(1002).setScrollFactor(0);

          const mssgBox = this.add
            .rectangle(300 - 140 + i * 75, 290, 50, 50, 0x000000)
            .setScrollFactor(0)
            .setDepth(1003)
            .setAlpha(0.5);

          const mssgLabel = this.add
            .text(300 - 140 + i * 75 - 15, 280, `Histor\nMessage ${i}`, {
              fontSize: '10px',
              color: '#ffffff',
            })
            .setScrollFactor(0)
            .setDepth(1004);

          mssgBox.setInteractive({ useHandCursor: true });
          //TODO: finish the message display feature
          mssgBox.on('pointerover', (pointer: Phaser.Input.Pointer) => {
            const worldPoint = this.cameras.main.getWorldPoint(
              pointer.x,
              pointer.y,
            );

            if (!this.subMssg) {
              this.subMssgText = this.add
                .text(worldPoint.x, worldPoint.y, mssgText, {
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

    // this.input.keyboard!.on("keydown-ESC", () => {
    //   if(mssgMenu) {
    //     mssgMenu.destroy();
    //     mssgMenu = null;
    //   }
    // })

    // let promptTexts = [];

    this.controlMapping = [
      { activateIndex: 0, triggerKey: Phaser.Input.Keyboard.KeyCodes.ONE },
      { activateIndex: 1, triggerKey: Phaser.Input.Keyboard.KeyCodes.TWO },
      { activateIndex: 2, triggerKey: Phaser.Input.Keyboard.KeyCodes.THREE },
    ];

    this.keyMap = setupKeyListeners(this.controlMapping, this.input);

    for (let i = 0; i < 3; i++) {
      const text = this.add.text(
        startX + i * (squareSize + spacing) - 15,
        startY - 15,
        `empty`,
        {
          fontSize: '10px',
          color: '#ffffff',
          wordWrap: { width: squareSize, useAdvancedWrap: true },
        },
      );
      this.promptTexts.push(text);
      text.setScrollFactor(0);
      text.setDepth(1000);
    }

    // add controls UI
    this.agentControlButtons = this.add.group();
    this.agentControlButtonLabels = [];

    addAgentSelectionMenuHUD.call(this);
    this.overlappedItems = new Set();
    let overlappedItems = new Set();
    let isDebate = false;
    let debateStartBtn = null;
    let debateStartLabel = null;

    // this.physics.add.overlap(this.agentGroup, this.debatePositionGroup, (agent, item) => {
    //   overlappedItems.add(item);
    //   if (overlappedItems.size === 2 && !isDebate) {
    //       isDebate = true;
    //       console.log("Agent is overlapping both debate positions!");
    //       debateStartBtn = this.add.rectangle(50, 400, 50, 50, 0x000000).setScrollFactor(0).setDepth(1001).setAlpha(0.5).setInteractive();
    //       debateStartBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    //         console.log("start debate!!");
    //         // start communicating with back-end api

    //       })
    //   }
    // });

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

    // this.physics.add.overlap(this.debatePositionGroup, this.agentGroup, (item, agent) => {
    //   isDebate = false;
    //   overlappedItems.delete(item);
    // }, undefined, this);

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
  }

  private collectItem(player: any, item: any) {
    if (state.isTypewriting || state.collectedItems?.has(item)) {
      return;
    }

    state.isTypewriting = true;

    render(
      <Typewriter
        text={`Prompt Utility: think step-by-step`}
        onEnd={() => {
          state.isTypewriting = false;
          console.log('collected prompt utils', player.getPromptUtils());
          const spaceKey = this.input.keyboard?.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE,
          );

          const destroyItem = () => {
            if (item.active) {
              item.destroy();
              player.addPromptUtils('think step by step');
              console.log('Item destroyed!');
              this.itemText?.destroy();
            }

            spaceKey?.off('down', destroyItem);
          };
          spaceKey?.on('down', destroyItem);
        }}
      />,
      this,
    );
  }

  private collectDeductiveReasoning(player: any, item: any) {
    if (state.isTypewriting || state.collectedItems?.has(item)) {
      return;
    }

    state.isTypewriting = true;

    render(
      <Typewriter
        text={`Prompt Utility: Deductive Reasoning`}
        onEnd={() => {
          state.isTypewriting = false;
          console.log('collected prompt utils', player.getPromptUtils());
          const spaceKey = this.input.keyboard?.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE,
          );

          const destroyItem = () => {
            if (item.active) {
              item.destroy();
              player.addPromptUtils('deductive reasoning');
              this.deductiveItemText?.destroy();
            }

            spaceKey?.off('down', destroyItem);
          };
          spaceKey?.on('down', destroyItem);
        }}
      />,
      this,
    );
  }

  private async onPlayerNearNPC(npc: any, agent: any) {
    // console.log("prompt utils", npc, agent);
    //console.log('onPlayerNearNPC', agent, npc);
    if (this.cursors.space.isDown && !state.isTypewriting) {
      state.isTypewriting = true;

      const player = agent;

      console.log('prompt utils', player, npc, agent);

      const npcName = npc.getData('npcName') || 'Mysterious NPC';

      let systemMssg = `${agent.getPersona()}, this prompt is for testing`;

      if (agent.inventory.promptUtils.length > 0) {
        systemMssg += `
        you have collected ${agent.inventory.promptUtils}, 
        please utilize collected prompt utils to solve the task
        `;
      }

      const userMssg = `
            you have collected ${agent.inventory.promptUtils}, 
            please utilize collected prompt utils to solve the task
            please solve this task(maxn words: 150):
            How many R's are in the word strawberry?
          `;

      const messages = [
        {
          role: 'system',
          content: systemMssg,
        },
        {
          role: 'user',
          content: userMssg,
        },
      ];

      console.log('messages:', messages);

      try {
        const response = await fetchChatCompletion(messages);
        console.log('OpenAI return:', response);

        const aiReply = response.choices[0].message.content;

        this.mssgData.push({
          system: systemMssg,
          user: userMssg,
          gpt: aiReply,
        });

        agent.storeMemory(systemMssg, userMssg, aiReply);

        console.log('mssgData:', this.mssgData, agent.getMemory());

        render(
          <Typewriter
            text={aiReply}
            onEnd={() => (state.isTypewriting = false)}
          />,
          this,
        );
      } catch (error) {
        console.error('API request failed', error);
        state.isTypewriting = false;
      }
    }
  }

  private addPlayer() {
    // Object layers in Tiled let you embed extra info into a map like a spawn point or custom collision shapes.
    // In the tmx file, there's an object layer with a point named 'Spawn Point'.
    const spawnPoint = this.tilemap.findObject(
      TilemapLayer.Objects,
      ({ name }) => name === TilemapObject.SpawnPoint,
    )!;

    this.player = new Player(this, spawnPoint.x!, spawnPoint.y!);
    this.addPlayerSignInteraction();

    // Watch the player and worldLayer for collisions
    this.physics.add.collider(this.player, this.worldLayer);
  }

  private addPlayerSignInteraction() {
    const sign = this.tilemap.findObject(
      TilemapLayer.Objects,
      ({ name }) => name === TilemapObject.Sign,
    )!;

    this.sign = this.physics.add.staticBody(
      sign.x!,
      sign.y!,
      sign.width,
      sign.height,
    );
    this.sign.text = sign.properties[0].value;

    type ArcadeColliderType = Phaser.Types.Physics.Arcade.ArcadeColliderType;

    this.physics.add.overlap(
      this.sign as unknown as ArcadeColliderType,
      this.player.selector as unknown as ArcadeColliderType,
      (sign) => {
        if (this.player.cursors.space.isDown && !state.isTypewriting) {
          state.isTypewriting = true;

          render(
            <Typewriter
              text={(sign as unknown as Sign).text!}
              onEnd={() => (state.isTypewriting = false)}
            />,
            this,
          );
        }
      },
      undefined,
      this,
    );
  }

  update() {
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



  //   var touching = !this.debatePositionGroup.body.touching.none;
  // var wasTouching = !block.body.wasTouching.none;
  
  // // If you want touching OR embedded then use:
  // // var touching = !block.body.touching.none || block.body.embedded;

  // if (touching && !wasTouching) block.emit("overlapstart");
  // if (!touching && wasTouching) block.emit("overlapend");

    this.agentGroup.on('overlapstart', (agent: any, item: any) => {
      console.log('overlapstart', agent, item);
    });

    // this.agentGroup.children.iterate((agent: any) => {
    //   let wasTouching = !agent.body.wasTouching.none;
    //   let touching = !agent.body.touching.none;

    //   if (!touching && wasTouching) {
    //     console.log('Agent exited debate position!');
    //     this.isDebate = false;

    //     // remove debate button
        


    //     this.overlappedItems.forEach((item) => {
    //       if (!this.physics.world.overlap(agent, item)) {
    //         this.overlappedItems.delete(item);
    //       }
    //     });
    //   }
    // });

    if(this.cursors.seven.isDown) {
      this.scene.start('level1');
    } else if(this.cursors.eight.isDown) {
      // this.scene.start('level2');
    } else if(this.cursors.nine.isDown) {
      this.scene.start('Main');
    }
  }
}
