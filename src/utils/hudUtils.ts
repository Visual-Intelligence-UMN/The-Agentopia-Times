
export function addDebateButton(){
  
}


export function addAgentPanelHUD(
  this: any,
  startX: number,
  startY: number,
  squareSize: number,
  spacing: number,
) {
  this.hudText = this.add.text(
    50,
    450,
    `${this.controllableCharacters[this.activateIndex].getName()} (Player-controlled) `,
    {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 },
    },
  );

  this.hudText.setScrollFactor(0);
  this.hudText.setDepth(999);

  const frame = this.add.rectangle(200, 500, 350, 125, 0x000000);
  frame.setStrokeStyle(2, 0xffffff);
  frame.setScrollFactor(0);
  frame.setDepth(998);
  frame.setAlpha(0.5);

  let popupRect: Phaser.GameObjects.Rectangle | null = null;
  let popupText: Phaser.GameObjects.Text | null = null;
  for (let i = 0; i < 3; i++) {
    const rect = this.add.rectangle(
      startX + i * (squareSize + spacing),
      startY,
      squareSize,
      squareSize,
      0x000000,
    );
    rect.setStrokeStyle(2, 0xffffff);
    rect.setScrollFactor(0);
    rect.setDepth(999);
    rect.setAlpha(0.5);
    rect.setInteractive({ useHandCursor: true });

    rect.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

      console.log('pointerover', worldPoint.x, worldPoint.y);
      if (!popupRect) {
        popupRect = this.add
          .rectangle(worldPoint.x + 20, worldPoint.y + 20, 150, 80, 0x000000)
          .setDepth(1000)
          .setStrokeStyle(2, 0xffffff);

        console.log('popupRect add', popupRect);

        //TODO: make prompt utility more explicitly

        let textLabel = 'empty';
        if (this.playerControlledAgent.getPromptUtils().length > i) {
          textLabel = this.playerControlledAgent.getPromptUtils()[i];
        }

        popupText = this.add
          .text(worldPoint.x - 35, worldPoint.y, textLabel, {
            fontSize: '10px',
            color: '#ffffff',
            wordWrap: { width: 150, useAdvancedWrap: true },
          })
          .setDepth(1001);
      }
    });

    rect.on('pointerout', () => {
      console.log('pointerout');
      if (popupRect) {
        popupRect.destroy();
        popupText?.destroy();
        popupRect = null;
        console.log('popupRect remove', popupRect);
      }
    });
  }
}

export function addAgentSelectionMenuHUD(this: any) {
  for (let i = 0; i < this.controllableCharacters.length; i++) {
    let buttonGroup = this.add.group();
    const btn = this.add
      .rectangle(425 + i * 60, 540, 50, 50, 0x000000)
      .setScrollFactor(0)
      .setDepth(999)
      .setAlpha(0.5)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive();
    const btnLabel = this.add
      .text(425 + i * 60 - 15, 535, this.controllableCharacters[i].getName(), {
        fontSize: '10px',
        color: '#ffffff',
      })
      .setScrollFactor(0)
      .setDepth(1000);
    buttonGroup.add(btn);
    buttonGroup.add(btnLabel);
    this.agentControlButtonLabels.push(btnLabel);
    btn.on('pointerdown', () => {
      this.activateIndex = i;
      this.cameras.main.startFollow(
        this.controllableCharacters[this.activateIndex],
      );
      this.playerControlledAgent =
        this.controllableCharacters[this.activateIndex];
      this.controllableCharacters.forEach((agent: any) => {
        agent.changeNameTagColor('#ffffff');
      });
      this.agentControlButtonLabels.forEach((btnLabel: any) => {
        btnLabel.setColor('#ffffff');
      });
      btnLabel.setColor('#ff0000');
      this.playerControlledAgent.changeNameTagColor('#ff0000');
    });
  }

  this.agentControlButtonLabels[0].setColor('#ff0000');
}

export function addSceneNameHUD(this: any){
  // add scene's name to the HUD 
  this.hudText = this.add.text(600, 10, this.sceneName, {
    fontSize: '20px',
    color: '#ffffff',
  }).setScrollFactor(0).setDepth(1000);
}



