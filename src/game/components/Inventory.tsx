import Phaser from 'phaser';

export class Inventory extends Phaser.GameObjects.Container {
  private inventoryBg!: Phaser.GameObjects.Rectangle;
  private inventoryText!: Phaser.GameObjects.Text;
  private items: string[] = [];
  private itemTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.inventoryBg = scene.add.rectangle(0, 0, 300, 200, 0x000000, 0.8);
    this.inventoryBg.setStrokeStyle(2, 0xffffff);

    this.inventoryText = scene.add.text(-120, -80, 'Inventory', {
      fontSize: '20px',
      color: '#ffffff',
    });

    this.add([this.inventoryBg, this.inventoryText]);

    this.setVisible(false);
    scene.add.existing(this);
  }

  addItem(itemName: string) {
    if (!this.items.includes(itemName)) {
      this.items.push(itemName);

      const itemText = this.scene.add.text(-120, -50 + this.items.length * 30, `- ${itemName}`, {
        fontSize: '18px',
        color: '#ffffff',
      });

      itemText.setInteractive().on('pointerdown', () => {
        console.log(`Used ${itemName}`);
        this.removeItem(itemName);
      });

      this.itemTexts.push(itemText);
      this.add(itemText);
    }
  }

  removeItem(itemName: string) {
    const index = this.items.indexOf(itemName);
    if (index !== -1) {
      this.items.splice(index, 1);
      this.itemTexts[index].destroy();
      this.itemTexts.splice(index, 1);
    }
  }


  toggle() {
    this.setVisible(!this.visible);
  }
}
