import Phaser from 'phaser';
import { Player } from '../sprites';
import { Agent } from '../sprites/Agent';
import { AgentPerspectiveKeyMapping } from '../utils/controlUtils';

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



}
