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


  protected levelPassed: boolean = false;


  protected sceneName: string = 'Game: Level 1';

  protected testnpc!: Phaser.Physics.Arcade.Sprite;

  constructor(
    keyName: string = 'level1', 
    sceneName: string = 'Game: Level 1'
) {
    super({ key: keyName});
    this.sceneName = sceneName;
  }

  create(){

  }

  update(){

  }

  protected collectItem(player: any, item: any, innerText: string) {
    if (state.isTypewriting || state.collectedItems?.has(item)) {
      return;
    }

    state.isTypewriting = true;

    render(
      <Typewriter
        text={"Prompt Utils: "+innerText}
        onEnd={() => {
          state.isTypewriting = false;
          console.log('collected prompt utils', player.getPromptUtils());
          const spaceKey = this.input.keyboard?.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE,
          );

          const destroyItem = () => {
            if (item.active) {
              item.destroy();
              player.addPromptUtils(innerText);
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

  protected collectDeductiveReasoning(player: any, item: any) {
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
            please solve this task(maxn words: 150):
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

        agent.storeMemory(systemMssg, userMssg, aiReply);

        console.log('mssgData:', this.mssgData, agent.getMemory());

        render(
          <Typewriter
            text={aiReply}
            onEnd={() => (state.isTypewriting = false)}
          />,
          this,
        );

        // add to next level if the answer is correct
        if (aiReply.includes("three") || aiReply.includes("Three") || aiReply.includes("3")) {
          console.log("CORRECT ANSWER");
          // add a level-transition button to the UI
          if(!this.levelPassed){
            console.log("levelPassed", this.levelPassed);
            this.levelPassed = true;
            this.levelBtn = addButtonHUD.call(this, 425, 475, 50, 50, 'Next Level', 17.5, 10);
            this.levelBtn?.on('pointerdown', () => {
              console.log('levelBtn clicked');
              this.scene.start("level2");
            }, this)
          }
        }

      } catch (error) {
        console.error('API request failed', error);
        state.isTypewriting = false;
      }
    }
  }



}
