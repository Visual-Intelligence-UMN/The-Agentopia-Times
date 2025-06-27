import Phaser from 'phaser';

import { key } from '../constants';
import { Inventory } from './Player';

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

  private wasDragged: boolean = false; // if user drag the agent now


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

    // this.nameTag = scene.add.text(x, y - 20, name, {
    //     fontSize: '14px',
    //     color: '#ffffff',
    //     backgroundColor: '#00000088',
    //     padding: { x: 4, y: 2 },
    //     align: 'center',
    //   }).setOrigin(0.5, 1); 

    // this.nameTag.setDepth(10);
    
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

    // 监听拖拽事件
    // scene.input.on('dragstart', (pointer:any, gameObject:any) => {
    //   if (gameObject === this) {
    //     this.setTint(0xff0000); // 拖拽开始时变红
    //   }
    // });

    // scene.input.on('drag', (pointer:any, gameObject:any, dragX:number, dragY:number) => {
    //   if (gameObject === this) {
    //     this.x = dragX;
    //     this.y = dragY;
    //     // this.nameTag.setPosition(this.x, this.y - 25); 
    //   }
    // });

    //     scene.input.on('dragend', (pointer:any, gameObject:any) => {
    //   if (gameObject === this) {
    //     this.clearTint(); // 结束拖A拽后恢复原色
    //   }
    // });


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
    // this.nameTag.setPosition(this.x, this.y - 25);
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

    private onClick(pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) {
      if (gameObject === this) {
        console.log(`Agent ${this.name} clicked!`);
        // this.changeNameTagColor('#ff00ff'); 
        if(!this.isBiased){
          // update to biased agent
          // choose the designated bias by occupation
          this.name = "Biased " + this.name;
          // this.nameTag.setText(this.name);
          this.isBiased = true;
          
          this.setTexture(key.atlas.bias);
          this.createAnimations(key.atlas.bias);     
          this.bias = 'biased';
          console.log("Agent is now biased:", this.name, this.isBiased, this.getBias());     
          // this.play("player_down");
        } else {
          // update to unbiased agent
          this.name = this.name.split(' ').slice(-1).join(' ');
          // this.nameTag.setText(this.name);
          this.isBiased = false;

          this.setTexture(key.atlas.player);
          this.createAnimations(key.atlas.player);
          // this.play("player_down");
        }
      }
    }

    public setToBiased(){
        console.log(`Agent ${this.name} clicked!`);
        // this.changeNameTagColor('#ff00ff'); 
          // update to biased agent
          // choose the designated bias by occupation
          this.name = "Biased " + this.name;
          // this.nameTag.setText(this.name);
          this.isBiased = true;
          
          this.setTexture(key.atlas.bias);
          this.createAnimations(key.atlas.bias);          
          // this.play("player_down");
          this.bias = 'biased';
          console.log("Agent is now biased:", this.name, this.isBiased, this.getBias());
    }

    private createWorkAnimations(atlasKey: string) {

      // console.log("✅ texture keys:", this.scene.textures.getTextureKeys());
      // console.log("✅ work texture object:", this.scene.textures.get('work'));
      // console.log("✅ work frames:", this.scene.textures.get('work').getFrameNames());
      
      

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
    

    // private createAnimations(atlasKey: string) {
    //   const anims = this.scene.anims;
    
    //   const animList = [
    //     { key: Animation.Left, prefix: 'misa-left-walk.' },
    //     { key: Animation.Right, prefix: 'misa-right-walk.' },
    //     { key: Animation.Up, prefix: 'misa-back-walk.' },
    //     { key: Animation.Down, prefix: 'misa-front-walk.' },
    //   ];
    
    //   for (const { key, prefix } of animList) {
    //     anims.remove(key); // 确保更新贴图时重新生成
    //     anims.create({
    //       key,
    //       frames: anims.generateFrameNames(atlasKey, {
    //         prefix,
    //         start: 0,
    //         end: 3,
    //         zeroPad: 3,
    //       }),
    //       frameRate: 10,
    //       repeat: -1,
    //     });
    //   }
    // }
    

  // private createAnimations() {
  //   const anims = this.scene.anims;

  //   // Create left animation
  //   if (!anims.exists(Animation.Left)) {
  //     anims.create({
  //       key: Animation.Left,
  //       frames: anims.generateFrameNames(key.atlas.player, {
  //         prefix: 'misa-left-walk.',
  //         start: 0,
  //         end: 3,
  //         zeroPad: 3,
  //       }),
  //       frameRate: 10,
  //       repeat: -1,
  //     });
  //   }

  //   // Create right animation
  //   if (!anims.exists(Animation.Right)) {
  //     anims.create({
  //       key: Animation.Right,
  //       frames: anims.generateFrameNames(key.atlas.player, {
  //         prefix: 'misa-right-walk.',
  //         start: 0,
  //         end: 3,
  //         zeroPad: 3,
  //       }),
  //       frameRate: 10,
  //       repeat: -1,
  //     });
  //   }

  //   // Create up animation
  //   if (!anims.exists(Animation.Up)) {
  //     anims.create({
  //       key: Animation.Up,
  //       frames: anims.generateFrameNames(key.atlas.player, {
  //         prefix: 'misa-back-walk.',
  //         start: 0,
  //         end: 3,
  //         zeroPad: 3,
  //       }),
  //       frameRate: 10,
  //       repeat: -1,
  //     });
  //   }

  //   // Create down animation
  //   if (!anims.exists(Animation.Down)) {
  //     anims.create({
  //       key: Animation.Down,
  //       frames: anims.generateFrameNames(key.atlas.player, {
  //         prefix: 'misa-front-walk.',
  //         start: 0,
  //         end: 3,
  //         zeroPad: 3,
  //       }),
  //       frameRate: 10,
  //       repeat: -1,
  //     });
  //   }
  // }
}