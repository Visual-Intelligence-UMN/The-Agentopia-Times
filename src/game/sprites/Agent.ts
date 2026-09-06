import Phaser from 'phaser';

import { key } from '../constants';
import { Inventory } from './Player';
import { EventBus } from '../EventBus';
import { recorder } from '../utils/recorder';

enum Animation {
  Left = 'player_left',
  Right = 'player_right',
  Up = 'player_up',
  Down = 'player_down',
}

interface Memory {
  system: string;
  user: string;
  gpt: string;
  currentPrompts: string[];
  result: boolean;
}

export class Agent extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  selector: Phaser.Physics.Arcade.StaticBody;
  name: string;

  // private nameTag: Phaser.GameObjects.Text;
  private memory: Memory[] = [];
  private persona: string = "a helpful AI assistant";
  private instruction: string = "";
  private bias: string = "";
  private isBiased: boolean = false;
  private editorialManager: boolean = false;
  private mssgSprite: Phaser.GameObjects.Image | null = null;

  private wasDragged: boolean = false; // if user drag the agent now

  public isDrag: boolean = false; // track drag state


  // public static biasedAgentsCount: number = 0; // Calculate the current number of biased agents in this level

  public static biasedAgentsCount: number = 0;     // Current number of "labeled hallucinations"
  public static maxAllowedBiased: number = 1;      // Maximum quantity allowed (L1=1, L2=2, L3=3)
  public static biasedOrder: Agent[] = [];         // Record order of selection
  public static currentBiasedAgent: Agent | null = null; // Reservation: pointing to the "last selected"


  private agentInformation:string = "aaaaaaa";

  public addMssgSprite(scene: Phaser.Scene, texture: string, frame?: string | number) {
  if (this.mssgSprite) {
    console.log("Updating message sprite for agent:", this.name);
    this.mssgSprite.setTexture(texture, frame);

    this.mssgSprite.removeAllListeners();
    this.mssgSprite.disableInteractive();

    if (texture === "agent_mssg") {
      this.mssgSprite.setInteractive({ useHandCursor: true });
      this.mssgSprite.on('pointerdown', () => {
        console.log(`Message sprite of ${this.name} clicked!`);
        this.changeNameTagColor('#00ff00');
        EventBus.emit("open-agent-information", {
          agent: this.name
        });
      });
    }
    return;
  }

  console.log("Adding message sprite to agent:", this.name);
  this.mssgSprite = scene.add.image(this.x, this.y, texture, frame)
    .setOrigin(0.5, 1)
    .setDepth(10);

  if (texture === "agent_mssg") {
    this.mssgSprite.setInteractive({ useHandCursor: true });
    this.mssgSprite.on('pointerdown', () => {
      console.log(`Message sprite of ${this.name} clicked!`);
      this.changeNameTagColor('#00ff00');
      EventBus.emit("open-agent-information", {
          agent: this.name
        });
    });
  }
}



  
  // Add reset method of the calculation of the biased agents
  public static resetBiasedAgentsCount() {
    Agent.biasedAgentsCount = 0;
    Agent.currentBiasedAgent = null;
    Agent.biasedOrder = [];
  }

    private biasType: string = "";
  public setBiasType(type: string) {
    this.biasType = type;
  }
  public getBiasType() {
    return this.biasType;
  }

  public getAgentInformation(){
    return this.agentInformation;
  }

  public setAgentInformation(info: string) {
    this.agentInformation = info;
    EventBus.emit("agent-information", {
      agent: this.name,
      mssg: this.getAgentInformation()
    });
  }


public playDialogue(
  scene: Phaser.Scene,
  text: string,
  speed: number = 50,
  sentencePause: number = 1500
) {
  // 1. 按标点切分成句子数组（支持中英文）
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]/g) || [text];

  // 2. 在 Agent 右上角添加文本
  let textObj = scene.add.text(this.x + 40, this.y - 40, "", {
    fontSize: "16px",
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.5)",
    wordWrap: { width: 200 }
  }).setDepth(20);

  let currentSentenceIndex = 0;
  let charIndex = 0;
  let isPaused = false;

  scene.time.addEvent({
    delay: speed,
    loop: true,
    callback: () => {
      if (isPaused) return;

      const sentence = sentences[currentSentenceIndex];

      if (charIndex < sentence.length) {
        // 逐字输出
        textObj.text += sentence[charIndex];
        charIndex++;
      } else {
        // 一句话播完 → 停顿 → 清空 → 下一句
        isPaused = true;
        scene.time.delayedCall(sentencePause, () => {
          currentSentenceIndex++;
          charIndex = 0;

          if (currentSentenceIndex < sentences.length) {
            textObj.text = "";   // ✅ 清空上句
            isPaused = false;    // 开始下一句
          } else {
            console.log(`✅ Agent ${this.name} 所有句子播放完毕`);
            textObj.destroy();   // 最后一条播完移除
          }
        });
      }
    }
  });


  scene.events.on("update", () => {
    if (textObj && textObj.active) {
      textObj.setPosition(this.x + 40, this.y - 40);
    }
  });
}


  public assignToWorkplace: boolean = false;
  private activationFunction: (state: any) => any = (state: any) => {
    console.log(`---Step for Agent: ${this.name}---`);
    return state;
  };

  public inventory: Inventory = {
      promptUtils: [],
      tools: [],
    }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture:any = key.atlas.player,
    frame:any = 'misa-front',
    name: string = "Agent",
    persona: string = "a helpful AI assistant",
    bias: string = ""
  ) {
    super(scene, x, y, texture, frame);

    this.name = name;
    this.persona = persona;
    // Add the sprite to the scene
    scene.add.existing(this);

    // Enable physics for the sprite
    scene.physics.world.enable(this);
    scene.physics.add.existing(this);

    // The image has a bit of whitespace so use setSize and
    // setOffset to control the size of the player's body
    this.setSize(32, 42).setOffset(0, 22);

    // Collide the sprite body with the world boundary
    this.setImmovable(true);
    this.body.setAllowGravity(false);
    this.setCollideWorldBounds(true);


    // Create sprite animations
    this.createAnimations(key.atlas.player);

    // this.createWorkAnimations(key.atlas.work);

    this.selector = scene.physics.add.staticBody(x - 8, y + 32, 16, 16);

    // this.setInteractive({ useHandCursor: true });
    // scene.input.on('gameobjectdown', this.onClick, this);

    this.setInteractive({ useHandCursor: true, draggable: true }); // 允许拖拽
    scene.input.setDraggable(this);

    scene.input.on('dragstart', (pointer: any, gameObject: any) => {
      if (gameObject === this) {
        this.wasDragged = false;
        this.setTint(0xff0000);
      }
    });

    scene.input.on('drag', (pointer: any, gameObject: any, dragX: number, dragY: number) => {
      if (gameObject === this) {
        this.isDrag = true; // 设置拖拽状态
        this.x = dragX;
        this.y = dragY;
        this.wasDragged = true;
        // this.nameTag.setPosition(this.x, this.y - 25);
      }
    });

    scene.input.on('dragend', (pointer: any, gameObject: any) => {
      if (gameObject === this) {
        this.isDrag = false;
        this.clearTint();
      }
    });

    // this.on('pointerdown', (pointer:any) => {
    //   this.onClick(pointer, this);
    // });

    this.on('pointerup', (pointer: any) => {
      if (!this.wasDragged) {
        this.onClick(pointer, this);
      }
    });
  }

update() {
    this.mssgSprite?.setPosition(this.x - 15, this.y);
  }

  public getName(){
    return this.name;
  }

  public getBias(){
    if(this.isBiased)return this.bias;
    else return "";
  }
  
  public setBias(bias: string){
    this.bias = bias;
  }

  public changeNameTagColor(color: string){
    // this.nameTag.setColor(color);
  } 

  public storeMemory(system: string, user: string, gpt: string, currentPrompts: string[], result: boolean) {
    this.memory.push({ system, user, gpt, currentPrompts, result });
  }

  public getMemory() {
    return this.memory;
  }

  public getPersona() {
    return this.persona;
  }

  public activate() {
        return this.activationFunction;
    }

  public setActivationFunction(activationFunction: (state: any)=>any) {
      this.activationFunction = activationFunction;
  }

  public moveSelector(animation: Animation) {
    const { body, selector } = this;

    switch (animation) {
      case Animation.Left:
        selector.x = body.x - 19;
        selector.y = body.y + 14;
        break;

      case Animation.Right:
        selector.x = body.x + 35;
        selector.y = body.y + 14;
        break;

      case Animation.Up:
        selector.x = body.x + 8;
        selector.y = body.y - 18;
        break;

      case Animation.Down:
        selector.x = body.x + 8;
        selector.y = body.y + 46;
        break;
    }
  }

  public setInstruction(instruction: string) {
      this.instruction = instruction;
    }

  public getInstruction() {
      return this.instruction;
  }

  public addPromptUtils(promptUtils: string) {
      this.inventory.promptUtils.push(promptUtils);
    }
    
  public getPromptUtils() {
    return [...this.inventory.promptUtils];
  }


  public setTexture(key: string, frame?: string | number): this {
      super.setTexture(key, frame);
      return this;
  }

  // private onClick(pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) {
  //   if (gameObject === this) {
  //     console.log(`Agent ${this.name} clicked!`);

  //     // If there is already another biased agent, restore it first.        
  //     if (Agent.currentBiasedAgent && Agent.currentBiasedAgent !== this) {
  //       Agent.currentBiasedAgent.setToUnbiased();
  //     }

  //     if (!this.isBiased) {
  //       // Set to biased
  //       this.name = "Biased " + this.name;
  //       this.isBiased = true;
  //       this.setTexture(key.atlas.bias);
  //       this.createAnimations(key.atlas.bias);
  //       this.bias = 'biased';
  //       Agent.biasedAgentsCount = 1;
  //       Agent.currentBiasedAgent = this;

  //       console.log("Agent is now biased:", this.name);
  //     }
  //   }
  // }

    private static rebalanceBiasTypes(scene: Phaser.Scene) {
      const pool = (scene.registry.get('biasTypePool') as string[]) || ['factual'];
      const list = Agent.biasedOrder;
      if (pool.length === 0) return;

      for (let i = 0; i < list.length; i++) {
        const t = pool[i % pool.length];
        list[i].setBiasType(t);
      }
    }

    private onClick(pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) {
      
      recorder.recordEvent("agent_clicked");

      if (gameObject !== this) return;
      if (this.editorialManager) return;
      if (this.isBiased) return;

      if (Agent.biasedAgentsCount < Agent.maxAllowedBiased) {
        this.setToBiased();
      } else {
        const oldest = Agent.biasedOrder.shift();
        if (oldest && oldest !== this) oldest.setToUnbiased();
        this.setToBiased();
      }
      if (gameObject === this) {
        console.log(`Agent ${this.name} clicked!`);

        const agentInfo = this.getAgentInformation();
        console.log(`Agent Information: ${agentInfo}`);

        // If there is already another biased agent, restore it first.        
        if (Agent.currentBiasedAgent && Agent.currentBiasedAgent !== this) {
          Agent.currentBiasedAgent.setToUnbiased();
        }

        if (!this.isBiased) {
          // Set to biased
          this.name = "Biased " + this.name;
          this.isBiased = true;
          this.setTexture(key.atlas.bias);
          this.createAnimations(key.atlas.bias);
          this.bias = 'biased';
          // Agent.biasedAgentsCount = 1;
          // Agent.currentBiasedAgent = this;

          console.log("Agent is now biased:", this.name);
        }
      }
    }

    // Add method to revert to normal agent
    public setToUnbiased() {
      if (!this.isBiased) return;

      this.name = this.name.replace(/^Biased\s+/, "");
      this.isBiased = false;
      this.setTexture(key.atlas.player);
      this.createAnimations(key.atlas.player);

      Agent.biasedAgentsCount = Math.max(0, Agent.biasedAgentsCount - 1);

      const idx = Agent.biasedOrder.indexOf(this);
      if (idx >= 0) Agent.biasedOrder.splice(idx, 1);

      if (Agent.currentBiasedAgent === this) {
        Agent.currentBiasedAgent = Agent.biasedOrder.length
          ? Agent.biasedOrder[Agent.biasedOrder.length - 1]
          : null;
      }

      this.bias = '';
      this.setBiasType('');
      console.log("Agent is now unbiased:", this.name);

      (this.constructor as typeof Agent).rebalanceBiasTypes(this.scene);
    }

    public setToBiased() {
      if (this.isBiased || this.editorialManager) return;

      if (!/^Biased\s+/.test(this.name)) this.name = 'Biased ' + this.name;
      this.isBiased = true;
      this.setTexture(key.atlas.bias);
      this.createAnimations(key.atlas.bias);
      this.bias = 'biased';

      Agent.biasedAgentsCount++;
      Agent.currentBiasedAgent = this;
      Agent.biasedOrder.push(this);
      
      (this.constructor as typeof Agent).rebalanceBiasTypes(this.scene);

      const myIdx = Agent.biasedOrder.indexOf(this);
      console.log('[bias:assign]', {
        pool: this.scene.registry.get('biasTypePool'),
        myIdx,
        myType: this.getBiasType(),
        name: this.name,
      });
    }

    public setEditorialManager(assigned: boolean) {
      this.editorialManager = assigned;
    }

    public isEditorialManager() {
      return this.editorialManager;
    }


  private createWorkAnimations(atlasKey: string) {
    const anims = this.scene.anims;
  
    const baseKey = this.name;
        
    const animList = [
      { key: 'player_work', prefix: 'misa-work.' },
    ];
  
    for (const { key, prefix } of animList) {
      const fullKey = `${baseKey}_${key}`;
  
      if (anims.exists(fullKey)) anims.remove(fullKey);
  
      anims.create({
        key: fullKey,
        frames: anims.generateFrameNames(atlasKey, {
          prefix,
          start: 0,
          end: 11,
          zeroPad: 3,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  public setAgentState(state: 'work' | 'idle') {
    if (state === 'work') {
      if (!this.isBiased) {
        this.setTexture(key.atlas.workPlayer);
        this.createWorkAnimations(key.atlas.workPlayer);
        this.anims.play(`${this.name}_player_work`, true);
      } else {
        this.setTexture(key.atlas.workBias);
        this.createWorkAnimations(key.atlas.workBias);
        this.anims.play(`${this.name}_player_work`, true);
      }
    } else {
      this.anims.stop();
      this.setTexture(this.isBiased ? key.atlas.bias : key.atlas.player);
      this.createAnimations(this.isBiased ? key.atlas.bias : key.atlas.player);
    }
  }

  private createAnimations(atlasKey: string) {
    const anims = this.scene.anims;
  
    const baseKey = this.name;
  
    const animList = [
      { key: Animation.Left, prefix: 'misa-left-walk.' },
      { key: Animation.Right, prefix: 'misa-right-walk.' },
      { key: Animation.Up, prefix: 'misa-back-walk.' },
      { key: Animation.Down, prefix: 'misa-front-walk.' },
    ];
  
    for (const { key, prefix } of animList) {
      const fullKey = `${baseKey}_${key}`;
  
      if (anims.exists(fullKey)) anims.remove(fullKey);
  
      anims.create({
        key: fullKey,
        frames: anims.generateFrameNames(atlasKey, {
          prefix,
          start: 0,
          end: 5,
          zeroPad: 3,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }
  }
}
