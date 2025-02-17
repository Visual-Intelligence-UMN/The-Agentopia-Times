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
import { fetchChatCompletion } from '../server/server';
import { controlAgentMovements, initKeyboardInputs } from '../utils/controlUtils';
import { setupKeyListeners } from '../utils/controlUtils';
import { addAgentPanelHUD, addAgentSelectionMenuHUD, addSceneNameHUD } from '../utils/hudUtils';
import { createItem, setupScene } from '../utils/sceneUtils';
import { debateWithJudging } from '../server/simulations/debate';
import { ParentScene } from './ParentScene';

export class Level2 extends ParentScene {

  constructor() {
    super("level2");
    this.sceneName = "Game: Level 2";
  }

  create() {

    setupScene.call(this);

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
