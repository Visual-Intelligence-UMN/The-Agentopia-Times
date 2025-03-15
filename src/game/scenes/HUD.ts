import Phaser from 'phaser';

export class HUDScene extends Phaser.Scene {
  private hudText!: Phaser.GameObjects.Text;
  private isHUDVisible: boolean = true; // 控制 HUD 是否可见

  constructor() {
    super({ key: 'HUDScene' });
  }

  create() {
    console.log('HUDScene Created!'); // 确保 HUD 启动

    // 添加 HUD 文字
    this.hudText = this.add.text(50, 50, 'HUD: Active', {
      fontSize: '50px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 },
    });

    this.hudText.setScrollFactor(0); // 让 HUD 固定在屏幕上

    // 监听 ESC 键隐藏/显示 HUD
    this.input.keyboard?.on('keydown-ESC', () => this.toggleHUD());
    this.hudText.setDepth(999);

  }

  private toggleHUD() {
    this.isHUDVisible = !this.isHUDVisible;
    this.hudText.setVisible(this.isHUDVisible);
    console.log(`HUD ${this.isHUDVisible ? 'Visible' : 'Hidden'}`);
  }
}
