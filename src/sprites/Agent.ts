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
  role: string;
  content: string;
  system: string;
}

export class Agent extends Phaser.Physics.Arcade.Sprite {
  body!: Phaser.Physics.Arcade.Body;
  selector: Phaser.Physics.Arcade.StaticBody;
  name: string;

  private nameTag: Phaser.GameObjects.Text;
  private memory: Memory[] = [];
  private persona: string = "a helpful AI assistant";

  public inventory: Inventory = {
      promptUtils: [],
      tools: [],
    }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture = key.atlas.player,
    frame = 'misa-front',
    name: string = "Agent",
    persona: string = "a helpful AI assistant"
  ) {
    super(scene, x, y, texture, frame);

    this.name = name;
    this.persona = persona;

    this.nameTag = scene.add.text(x, y - 20, name, {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 4, y: 2 },
        align: 'center',
      }).setOrigin(0.5, 1); 

      this.nameTag.setDepth(10);
  

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
    this.createAnimations();

    this.selector = scene.physics.add.staticBody(x - 8, y + 32, 16, 16);

  }

  update() {
    this.nameTag.setPosition(this.x, this.y - 25);
  }

  public getName(){
        return this.name;
  }

  public changeNameTagColor(color: string){
    this.nameTag.setColor(color);
  } 

  public storeMemory(role: string, content: string, system: string) {
    this.memory.push({ role, content, system });
  }

  public getMemory() {
    return this.memory;
  }

  public getPersona() {
    return this.persona;
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

    public addPromptUtils(promptUtils: string) {
        this.inventory.promptUtils.push(promptUtils);
      }
    
      public getPromptUtils() {
        return this.inventory.promptUtils;
      }


    public setTexture(key: string, frame?: string | number): this {
        super.setTexture(key, frame);
        return this;
    }

  private createAnimations() {
    const anims = this.scene.anims;

    // Create left animation
    if (!anims.exists(Animation.Left)) {
      anims.create({
        key: Animation.Left,
        frames: anims.generateFrameNames(key.atlas.player, {
          prefix: 'misa-left-walk.',
          start: 0,
          end: 3,
          zeroPad: 3,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }

    // Create right animation
    if (!anims.exists(Animation.Right)) {
      anims.create({
        key: Animation.Right,
        frames: anims.generateFrameNames(key.atlas.player, {
          prefix: 'misa-right-walk.',
          start: 0,
          end: 3,
          zeroPad: 3,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }

    // Create up animation
    if (!anims.exists(Animation.Up)) {
      anims.create({
        key: Animation.Up,
        frames: anims.generateFrameNames(key.atlas.player, {
          prefix: 'misa-back-walk.',
          start: 0,
          end: 3,
          zeroPad: 3,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }

    // Create down animation
    if (!anims.exists(Animation.Down)) {
      anims.create({
        key: Animation.Down,
        frames: anims.generateFrameNames(key.atlas.player, {
          prefix: 'misa-front-walk.',
          start: 0,
          end: 3,
          zeroPad: 3,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }
  }
}
