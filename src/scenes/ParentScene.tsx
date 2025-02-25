import Phaser from 'phaser';
import { Player } from '../sprites';
import { Agent } from '../sprites/Agent';
import { AgentPerspectiveKeyMapping } from '../utils/controlUtils';
import { state } from '../state';
import { render } from 'phaser-jsx';

import { TilemapDebug, Typewriter } from '../components';
import { addButtonHUD } from '../utils/hudUtils';
import { fetchChatCompletion } from '../server/server';

export interface Sign extends Phaser.Physics.Arcade.StaticBody {
  text?: string;
}

export interface MessageRecord {
  system: string;
  user: string;
  gpt: string;
}

export class ParentScene extends Phaser.Scene {
  protected player!: Player;
  protected sign!: Sign;
  protected tilemap!: Phaser.Tilemaps.Tilemap;
  protected worldLayer!: Phaser.Tilemaps.TilemapLayer;
  protected itemGroup!: Phaser.Physics.Arcade.StaticGroup;
  protected deductiveItem!: Phaser.Physics.Arcade.StaticGroup;
  protected itemText!: Phaser.GameObjects.Text;
  protected npc!: Phaser.Physics.Arcade.Sprite;
  protected deductiveItemText!: Phaser.GameObjects.Text;
  protected hudText!: Phaser.GameObjects.Text;
  protected promptTexts: Phaser.GameObjects.Text[] = [];
  protected mssgData: MessageRecord[] = [];
  protected mssgMenu: Phaser.GameObjects.Rectangle | null = null;
  protected mssgMenuText: Phaser.GameObjects.Text | null = null;
  protected mssgGroup!: Phaser.GameObjects.Group;
  protected subMssg: Phaser.GameObjects.Rectangle | null = null;
  protected subMssgText: Phaser.GameObjects.Text | null = null;
  protected controllableCharacters: any[] = [];
  protected activateIndex: number = 0;
  protected playerControlledAgent!: Agent;
  protected cursors!: any;
  protected controlMapping!: AgentPerspectiveKeyMapping[];
  protected keyMap!: any;
  protected agentControlButtons!: Phaser.GameObjects.Group;

  protected agentGroup!: any;
  protected agentControlButtonLabels: Phaser.GameObjects.Text[] = [];
  protected overlappedItems: Set<any> = new Set();
  protected debatePositionGroup!: Phaser.Physics.Arcade.StaticGroup;
  protected isDebate: boolean = false;
  protected levelBtn!: Phaser.GameObjects.Rectangle;

  protected promptCoainter!: Phaser.GameObjects.Container;

  protected levelPassed: boolean = false;

  protected sceneName: string = 'Game: Level 1';

  protected testnpc!: Phaser.Physics.Arcade.Sprite;

  constructor(keyName: string = 'level1', sceneName: string = 'Game: Level 1') {
    super({ key: keyName });
    this.sceneName = sceneName;
  }

  create() {}

  update() {}


  protected renderDialog(dialogs: string[], currentDialogIndex: number) {
    if (currentDialogIndex >= dialogs.length) {
      return; 
  }

  state.isTypewriting = true;

  render(
      <Typewriter
          text={dialogs[currentDialogIndex]}
          onEnd={() => {
              state.isTypewriting = false;
              currentDialogIndex++;
              this.time.delayedCall(500, () => {
                  this.renderDialog(dialogs, currentDialogIndex);
              });
          }}
      />,
      this
  );

  }

  protected collectItem(
    player: any,
    item: any,
    innerText: string,
    itemText: any,
    mode: string = "prompt"
) {
    if (state.isTypewriting || state.collectedItems?.has(item)) {
        return;
    }

    console.log('Player is overlapping with the item.', player);
    state.isTypewriting = true; // 进入交互状态

    render(
        <Typewriter
            text={'Prompt Utils: ' + innerText}
            onEnd={() => {
                console.log('Typewriter finished.');

                const spaceKey = this.input.keyboard?.addKey(
                    Phaser.Input.Keyboard.KeyCodes.SPACE,
                );

                const handleSpacePress = () => {
                    if (!this.physics.overlap(player, item)) {
                        console.log('Player is no longer overlapping with the item. Action canceled.');
                        return;
                    }

                    state.isTypewriting = false; // 允许与其他物品交互

                    if (mode === "prompt") player.addPromptUtils(innerText);
                    else if (mode === "instruction") player.setInstruction(innerText);
                    console.log('PromptUtil collected:', innerText);

                    if (item.active) {
                        item.destroy();
                        console.log('Item destroyed!');
                        if (mode === "prompt") itemText?.destroy();
                    }

                    spaceKey?.off('down', handleSpacePress);
                };

                spaceKey?.on('down', handleSpacePress);
            }}
        />,
        this,
    );
}

protected onOverlapEnd(player: any, item: any) {
  console.log(`Agent ${player.getName()} exited ${item.texture.key} zone.`);
  
  if (state.isTypewriting) {
      state.isTypewriting = false;
      console.log('Reset state.isTypewriting because Agent exited item zone.');
  }
}



  protected async onPlayerNearNPC(npc: any, agent: any) {
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
            please solve this task(max words: 200), using concise examplanations:
            which one is bigger: 9.11 or 9.9?
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

        

        console.log('mssgData:', this.mssgData, agent.getMemory());

        render(
          <Typewriter
            text={aiReply}
            onEnd={() => (state.isTypewriting = false)}
          />,
          this,
        );

        // send the response to another LLM for evaluation
        const evalMssg = `
          if the following response answered: 
            9.9 is bigger than 9.11; 
          Then answer with "yes", otherwise answer with "no" \n
        ` + aiReply;

        const evalResponse = (await fetchChatCompletion([
          {
            role: 'system',
            content: 'evaluation',
          },
          {
            role: 'user',
            content: evalMssg,
          },
        ])).choices[0].message.content;

        console.log('evaluation response:', evalResponse);

        let result = false;

        // add to next level if the answer is correct
        if (
          evalResponse.includes('yes') ||
          evalResponse.includes('Yes') ||
          evalResponse.includes('YES')
        ) {
          console.log('CORRECT ANSWER');
          result = true;
          // add a level-transition button to the UI
          if (!this.levelPassed) {
            console.log('levelPassed', this.levelPassed);
            this.levelPassed = true;
            this.levelBtn = addButtonHUD.call(
              this,
              425,
              475,
              50,
              50,
              'Next Level',
              17.5,
              10,
            );
            this.levelBtn?.on(
              'pointerdown',
              () => {
                console.log('levelBtn clicked');
                this.scene.start('level2');
              },
              this,
            );
          }
        } else {

        }

        let utils = [];
        for(let i=0; i<agent.getPromptUtils().length; i++){
          utils.push(agent.getPromptUtils()[i]);
        }

        agent.storeMemory(systemMssg, userMssg, aiReply, utils, result);
      } catch (error) {
        console.error('API request failed', error);
        state.isTypewriting = false;
      }
    }
  }
}
