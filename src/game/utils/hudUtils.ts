import { Agent } from "../sprites/Agent";

export function addButtonHUD(
  this: any, 
  x: number, 
  y: number, 
  height: number, 
  width: number,
  text: string, 
  xOffset: number = 0,
  yOffset: number = 0,
){
  const button = this.add.rectangle(x, y, width, height, 0x000000)
  .setInteractive({ useHandCursor: true })
  .setStrokeStyle(2, 0xffffff)
  .setScrollFactor(0)
  .setDepth(999)
  .setAlpha(0.5);

  const buttonText = this.add.text(x - xOffset, y - yOffset, text, {
    fontSize: '10px',
    color: '#ffffff',
    wordWrap: { width: 50, useAdvancedWrap: true },
  })
  .setScrollFactor(0)
  .setDepth(1000);

  // Adding a HUD to an array
  this.hudElements.push(button, buttonText);

  return button;
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
    `Agent (Player-controlled) `,
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

  // Add all elements of the entire HUD panel to the array
  if (this.hudElements) {
    this.hudElements.push(frame, this.hudText);
  }

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

    // Add to HUD array
    if (this.hudElements) {
      this.hudElements.push(rect);
    }

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
        // if (this.playerControlledAgent.getPromptUtils().length > i) {
        //   textLabel = this.playerControlledAgent.getPromptUtils()[i];
        // }

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

export function addRoomHiringMenuHUD(this: any) {
  const rooms = ['validation', 'voting', 'routing'];
  const zones = [this.parallelZones, this.votingZones, this.routeZones];
  for (let i = 0; i < rooms.length; i++) {
    let buttonGroup = this.add.group();
    const btn = this.add
      .rectangle(425 + i * 60, 540, 50, 50, 0x000000)
      .setScrollFactor(0)
      .setDepth(999)
      .setAlpha(0.5)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive();
    const btnLabel = this.add
      .text(425 + i * 60 - 15, 535, rooms[i], {
        fontSize: '10px',
        color: '#ffffff',
      })
      .setScrollFactor(0)
      .setDepth(1000);
    buttonGroup.add(btn);
    buttonGroup.add(btnLabel);

    // Adding HUD elements to an array
    if (this.hudElements) {
      this.hudElements.push(btn, btnLabel);
    }

    this.agentControlButtonLabels.push(btnLabel);
    btn.on('pointerdown', () => {
      // get the corresponding room boundary
      let bounds: any = {};
      if(i!=0){
        console.log('room:', rooms[i], 'zone:', zones);
        const bounds = getZoneBounds(zones[i][0].zone);
        console.log('bounds:', bounds);
        const { x: agentX, y: agentY } = generateNonCollidingAgentPosition(this.controllableCharacters, bounds);

        const agent = new Agent(this, agentX, agentY, 'player', 'misa-front', 'Agent '+this.controllableCharacters.length);
        this.agentGroup.add(agent);
        this.controllableCharacters.push(agent);
        this.agentList.set(agent.getName(), agent);
      } else {
        if (zones[i][0].agentsInside.size===0){
          console.log('room:', rooms[i], 'zone:', zones);
          bounds = getZoneBounds(zones[i][0].zone);

        } else if(zones[i][1].agentsInside.size===0){
          console.log('room:', rooms[i], 'zone:', zones);
          bounds = getZoneBounds(zones[i][1].zone);
        }
        const { x: agentX, y: agentY } = generateNonCollidingAgentPosition(this.controllableCharacters, bounds);

        const agent = new Agent(this, agentX, agentY, 'player', 'misa-front', 'Agent '+this.controllableCharacters.length);
        this.agentGroup.add(agent);
        this.controllableCharacters.push(agent);
        this.agentList.set(agent.getName(), agent);

      }
    });
  }

  this.agentControlButtonLabels[0].setColor('#ff0000');
}

// function createTaskAt(this: any, x: number, y: number, roomName: string) {
//   const taskGroup = this.add.group();

//   const task = this.add
//     .rectangle(x, y, 50, 50, 0x000000)
//     .setScrollFactor(0)
//     .setDepth(999)
//     .setAlpha(0.5)
//     .setStrokeStyle(2, 0xffffff)
//     .setInteractive({ draggable: true });

//   const taskLabel = this.add
//     .text(x - 15, y - 5, roomName, {
//       fontSize: '10px',
//       color: '#ffffff',
//     })
//     .setScrollFactor(0)
//     .setDepth(1000);

//   taskGroup.add(task);
//   taskGroup.add(taskLabel);

//   const originalPos = {
//     x: task.x,
//     y: task.y,
//     labelX: taskLabel.x,
//     labelY: taskLabel.y
//   };

//   if (this.hudElements) {
//     this.hudElements.push(task, taskLabel);
//   }

//   task.on('dragstart', () => {
//     task.setScrollFactor(1);
//     taskLabel.setScrollFactor(1);
//   });

//   task.on('drag', (_: any, dragX: number, dragY: number) => {
//     task.setPosition(dragX, dragY);
//     taskLabel.setPosition(dragX - 15, dragY - 5);

//     const taskBounds = new Phaser.Geom.Rectangle(task.x - task.width / 2, task.y - task.height / 2, task.width, task.height);

//     let isOverlapping = false;

//     this.zoneBackgrounds?.forEach((bg: Phaser.GameObjects.Rectangle) => {
//       const bgBounds = new Phaser.Geom.Rectangle(bg.x - bg.width / 2, bg.y - bg.height / 2, bg.width, bg.height);
//       bg.setStrokeStyle(0);

//       if (Phaser.Geom.Rectangle.Overlaps(taskBounds, bgBounds)) {
//         isOverlapping = true;
//         task.setStrokeStyle(2, 0xff0000);
//         taskLabel.setColor('#ff0000');
//         bg.setStrokeStyle(2, 0xff0000);
//       }
//     });

//     if (!isOverlapping) {
//       task.setStrokeStyle(2, 0xffffff);
//       taskLabel.setColor('#ffffff');
//     }
//   });

//   task.on('dragend', () => {
//     const taskBounds = new Phaser.Geom.Rectangle(
//       task.x - task.width / 2,
//       task.y - task.height / 2,
//       task.width,
//       task.height
//     );

//     // ✅ 检查是否拖拽到了某个 zone 上
//     const allZones = [
//       ...this.parallelZones,
//       ...this.chainingZones,
//       ...this.votingZones,
//       ...this.routeZones
//     ];

//     let matchedZone = null;

//     for (const zone of allZones) {
//       const bg = zone.ui.background;
//       const bgBounds = new Phaser.Geom.Rectangle(
//         bg.x - bg.width / 2,
//         bg.y - bg.height / 2,
//         bg.width,
//         bg.height
//       );

//       if (Phaser.Geom.Rectangle.Overlaps(taskBounds, bgBounds)) {
//         matchedZone = zone;
//         break;
//       }
//     }

//     if (matchedZone) {
//       matchedZone.ui.text.setText(taskLabel.text);
//       // matchedZone.ui.text.setColor('#00ff00');
//       matchedZone.task = taskLabel.text;
//       console.log("Zone updated from createTaskAt:", matchedZone.name, matchedZone.task);
//     }

//     // ✅ 回弹动画
//     this.tweens.add({
//       targets: task,
//       x: originalPos.x,
//       y: originalPos.y,
//       duration: 300,
//       ease: 'Back.easeOut',
//       onComplete: () => {
//         task.setScrollFactor(0);
//       }
//     });

//     this.tweens.add({
//       targets: taskLabel,
//       x: originalPos.labelX,
//       y: originalPos.labelY,
//       duration: 300,
//       ease: 'Back.easeOut',
//       onComplete: () => {
//         taskLabel.setScrollFactor(0);
//       }
//     });

//     // ✅ 如果落在 zone 上，则销毁并重新生成任务卡片
//     this.zoneBackgrounds?.forEach((bg: Phaser.GameObjects.Rectangle) => {
//       const bgBounds = new Phaser.Geom.Rectangle(
//         bg.x - bg.width / 2,
//         bg.y - bg.height / 2,
//         bg.width,
//         bg.height
//       );
//       bg.setStrokeStyle(0);

//       if (Phaser.Geom.Rectangle.Overlaps(taskBounds, bgBounds)) {
//         task.destroy();
//         taskLabel.destroy();
//         this.time.delayedCall(100, () => {
//           createTaskAt.call(this, originalPos.x, originalPos.y, taskLabel.text);
//         });
//       }
//     });

//     task.setStrokeStyle(2, 0xffffff);
//     taskLabel.setColor('#ffffff');
//     this.zoneBackgrounds?.forEach((bg: Phaser.GameObjects.Rectangle) => {
//       bg.setStrokeStyle(0);
//     });
//   });
// }



// export function addTaskAssignmentHUD(this: any) {
//   const rooms = ['analysis', 'summary', 'extraction'];
//   for (let i = 0; i < rooms.length; i++) {
//     const x = 425 + i * 60;
//     const y = 540;

//     const taskGroup = this.add.group();

//     const task = this.add
//       .rectangle(x, y, 50, 50, 0x000000)
//       .setScrollFactor(0)
//       .setDepth(999)
//       .setAlpha(0.5)
//       .setStrokeStyle(2, 0xffffff)
//       .setInteractive({ draggable: true });

//     const taskLabel = this.add
//       .text(x - 15, y - 5, rooms[i], {
//         fontSize: '10px',
//         color: '#ffffff',
//       })
//       .setScrollFactor(0)
//       .setDepth(1000);

//     taskGroup.add(task);
//     taskGroup.add(taskLabel);

//     const originalPos = {
//       x: task.x,
//       y: task.y,
//       labelX: taskLabel.x,
//       labelY: taskLabel.y
//     };

//     if (this.hudElements) {
//       this.hudElements.push(task, taskLabel);
//     }

//     task.on('dragstart', () => {
//       task.setScrollFactor(1);
//       taskLabel.setScrollFactor(1);
//     });
    
//     task.on('drag', (_: any, dragX: number, dragY: number) => {
//       task.setPosition(dragX, dragY);
//       taskLabel.setPosition(dragX - 15, dragY - 5);
    
//       const taskBounds = new Phaser.Geom.Rectangle(task.x - task.width / 2, task.y - task.height / 2, task.width, task.height);
    
//       let isOverlapping = false;
    
//       this.zoneBackgrounds?.forEach((bg: Phaser.GameObjects.Rectangle) => {
//         const bgBounds = new Phaser.Geom.Rectangle(bg.x - bg.width / 2, bg.y - bg.height / 2, bg.width, bg.height);
    
//         bg.setStrokeStyle(0);

//         console.log('taskBounds:', taskBounds);
//         console.log('bgBounds:', bgBounds);
    
//         if (Phaser.Geom.Rectangle.Overlaps(taskBounds, bgBounds)) {
//           isOverlapping = true;
//           task.setStrokeStyle(2, 0xff0000);
//           taskLabel.setColor('#ff0000');
//           bg.setStrokeStyle(2, 0xff0000);
//         }
//       });
    
//       if (!isOverlapping) {
//         task.setStrokeStyle(2, 0xffffff);
//         taskLabel.setColor('#ffffff');
//       }
//     });
    
    
//     task.on('dragend', () => {
//       // 手动构造 task 的世界范围
//       const taskBounds = new Phaser.Geom.Rectangle(
//         task.x - task.width / 2,
//         task.y - task.height / 2,
//         task.width,
//         task.height
//       );
    
//       // ✅ 回到原位（UI模式）
//       this.tweens.add({
//         targets: task,
//         x: originalPos.x,
//         y: originalPos.y,
//         duration: 300,
//         ease: 'Back.easeOut',
//         onComplete: () => {
//           task.setScrollFactor(0);
//         }
//       });
    
//       this.tweens.add({
//         targets: taskLabel,
//         x: originalPos.labelX,
//         y: originalPos.labelY,
//         duration: 300,
//         ease: 'Back.easeOut',
//         onComplete: () => {
//           taskLabel.setScrollFactor(0);
//         }
//       });

//       this.roomStatusTexts?.forEach((bg: Phaser.GameObjects.Text) => {
//         const textBounds = bg.getBounds(); // 获取文本实际边界

//         bg.setStyle({ backgroundColor: null }); // 取消文本高亮（示例）

//         if (Phaser.Geom.Intersects.RectangleToRectangle(taskBounds, textBounds)) {
//           bg.text = taskLabel.text;
//           console.log("changed task reset");
//           // SET TASK
//           const allZones = [
//             ...this.parallelZones,
//             ...this.chainingZones,
//             ...this.votingZones,
//             ...this.routeZones
//           ];
          
//           const matchedZone = allZones.find((zone: any) => zone.ui.text === bg);
//           console.log("matchedZone", matchedZone);
//           if (matchedZone) {
//             matchedZone.task = taskLabel.text;
//             console.log("Zone task set via text overlap:", matchedZone.name, matchedZone.task);
//           }
//         }
//       });

//       this.zoneBackgrounds?.forEach((bg: Phaser.GameObjects.Rectangle) => {
//         const bgBounds = new Phaser.Geom.Rectangle(bg.x - bg.width / 2, bg.y - bg.height / 2, bg.width, bg.height);
    
//         bg.setStrokeStyle(0);

//         console.log('taskBounds:', taskBounds);
//         console.log('bgBounds:', bgBounds);
    
//         if (Phaser.Geom.Rectangle.Overlaps(taskBounds, bgBounds)) {
//           task.destroy();
//           taskLabel.destroy();
//           this.time.delayedCall(100, () => {
//             createTaskAt.call(this, originalPos.x, originalPos.y, taskLabel.text);
//           });
//         }
//       });

     
    
//       task.setStrokeStyle(2, 0xffffff);
//       taskLabel.setColor('#ffffff');
//       this.zoneBackgrounds?.forEach((bg: Phaser.GameObjects.Rectangle) => {
//         bg.setStrokeStyle(0);
//       });
//     });
    
    
//   }
// }


function createTaskCard(this: any, x: number, y: number, roomName: string) {
  const taskGroup = this.add.group();

  const task = this.add
    .rectangle(x, y, 50, 50, 0x000000)
    .setScrollFactor(0)
    .setDepth(999)
    .setAlpha(0.5)
    .setStrokeStyle(2, 0xffffff)
    .setInteractive({ draggable: true });

  const taskLabel = this.add
    .text(x - 15, y - 5, roomName, {
      fontSize: '10px',
      color: '#ffffff',
    })
    .setScrollFactor(0)
    .setDepth(1000);

  taskGroup.add(task);
  taskGroup.add(taskLabel);

  const originalPos = {
    x: task.x,
    y: task.y,
    labelX: taskLabel.x,
    labelY: taskLabel.y
  };

  if (this.hudElements) {
    this.hudElements.push(task, taskLabel);
  }

  task.on('dragstart', () => {
    task.setScrollFactor(1);
    taskLabel.setScrollFactor(1);
  });

  task.on('drag', (_: any, dragX: number, dragY: number) => {
    task.setPosition(dragX, dragY);
    taskLabel.setPosition(dragX - 15, dragY - 5);

    const taskBounds = new Phaser.Geom.Rectangle(task.x - 25, task.y - 25, 50, 50);
    let isOverlapping = false;

    this.zoneBackgrounds?.forEach((bg: Phaser.GameObjects.Rectangle) => {
      const bgBounds = new Phaser.Geom.Rectangle(bg.x - bg.width / 2, bg.y - bg.height / 2, bg.width, bg.height);
      bg.setStrokeStyle(0);

      if (Phaser.Geom.Rectangle.Overlaps(taskBounds, bgBounds)) {
        isOverlapping = true;
        task.setStrokeStyle(2, 0xff0000);
        taskLabel.setColor('#ff0000');
        bg.setStrokeStyle(2, 0xff0000);
      }
    });

    if (!isOverlapping) {
      task.setStrokeStyle(2, 0xffffff);
      taskLabel.setColor('#ffffff');
    }
  });

  task.on('dragend', () => {
    const taskBounds = new Phaser.Geom.Rectangle(task.x - 25, task.y - 25, 50, 50);
    const allZones = [
      ...this.parallelZones,
      ...this.chainingZones,
      ...this.votingZones,
      ...this.routeZones
    ];

    for (const zone of allZones) {
      const bg = zone.ui.background;
      const bgBounds = new Phaser.Geom.Rectangle(bg.x - bg.width / 2, bg.y - bg.height / 2, bg.width, bg.height);

      if (Phaser.Geom.Rectangle.Overlaps(taskBounds, bgBounds)) {
        zone.ui.text.setText(taskLabel.text);
        zone.task = taskLabel.text;
        console.log("Zone updated from drag:", zone.name, zone.task);
        break;
      }
    }

    this.roomStatusTexts?.forEach((textObj: Phaser.GameObjects.Text) => {
      const textBounds = textObj.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(taskBounds, textBounds)) {
        textObj.text = taskLabel.text;
        const matchedZone = allZones.find(z => z.ui.text === textObj);
        if (matchedZone) matchedZone.task = taskLabel.text;
      }
    });

    this.zoneBackgrounds?.forEach((bg: Phaser.GameObjects.Rectangle) => {
      const bgBounds = new Phaser.Geom.Rectangle(bg.x - bg.width / 2, bg.y - bg.height / 2, bg.width, bg.height);
      bg.setStrokeStyle(0);

      if (Phaser.Geom.Rectangle.Overlaps(taskBounds, bgBounds)) {
        task.destroy();
        taskLabel.destroy();
        this.time.delayedCall(100, () => {
          createTaskCard.call(this, originalPos.x, originalPos.y, taskLabel.text);
        });
      }
    });

    this.tweens.add({
      targets: [task, taskLabel],
      x: (target: any) => (target === task ? originalPos.x : originalPos.labelX),
      y: (target: any) => (target === task ? originalPos.y : originalPos.labelY),
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        task.setScrollFactor(0);
        taskLabel.setScrollFactor(0);
      }
    });

    task.setStrokeStyle(2, 0xffffff);
    taskLabel.setColor('#ffffff');
  });
}

export function addTaskAssignmentHUD(this: any) {
  const rooms = ['analysis', 'summary', 'extraction'];
  for (let i = 0; i < rooms.length; i++) {
    const x = 425 + i * 60;
    const y = 540;
    createTaskCard.call(this, x, y, rooms[i]);
  }
}




export function generateNonCollidingAgentPosition(existingAgents: any, bounds: any, agentRadius = 20, margin = 10, maxAttempts = 50) {
  let isColliding;
  let attempts = 0;
  let agentX: number;
  let agentY: number;

  do {
      agentX = bounds.topLeft.x + margin + Math.random() * (bounds.width - 2 * margin);
      agentY = bounds.topLeft.y + margin + Math.random() * (bounds.height - 2 * margin);

      isColliding = existingAgents.some((agent: any) => {
          const dx = agent.x - agentX;
          const dy = agent.y - agentY;
          return Math.sqrt(dx * dx + dy * dy) < agentRadius * 2; 
      });

      attempts++;
  } while (isColliding && attempts < maxAttempts);

  if (attempts >= maxAttempts) {
      console.warn("Failed to place agent without collision after max attempts.");
  }

  return { x: agentX, y: agentY };
}


export const getZoneBounds = (zone: any) => {
  return {
      topLeft: { x: zone.x - zone._displayOriginX, y: zone.y - zone._displayOriginY },
      bottomRight: { x: (zone.x - zone._displayOriginX) + zone.width, y: (zone.y - zone._displayOriginY) + zone.height },
      width: zone.width,
      height: zone.height
  };
};


export function addSceneNameHUD(this: any){
  // add scene's name to the HUD 
  this.hudText = this.add.text(600, 10, this.sceneName, {
    fontSize: '20px',
    color: '#ffffff',
  }).setScrollFactor(0).setDepth(1000);
}


export function addCreditsHUD(this: any){
  // const creditsIcon = this.add.image(570, 35, 'coinIcon') 
  //   .setOrigin(1, 0.5) 
  //   .setScrollFactor(0)
  //   .setDepth(1000);
  this.creditsText = this.add.text(600, 35, this.credits, {
    fontSize: '20px',
    color: '#ffffff',
  }).setScrollFactor(0).setDepth(1000);
}

export function drawArrow(
  this: any,
  start: { x: number, y: number },
  end: { x: number, y: number },
  r: number,
  graphics: Phaser.GameObjects.Graphics|null,
  color = 0xffffff,
  thickness = 2,
  fixedLength = 100 
) {
  if (!graphics) return;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return; 

  const dirX = dx / length;
  const dirY = dy / length;

  const fixedEnd = {
    x: start.x + dirX * fixedLength,
    y: start.y + dirY * fixedLength
  };

  const newStart = {
    x: start.x + dirX * r,
    y: start.y + dirY * r
  };

  graphics.lineStyle(thickness, color);
  graphics.beginPath();
  graphics.moveTo(newStart.x, newStart.y);
  graphics.lineTo(fixedEnd.x, fixedEnd.y);
  graphics.strokePath();

  const arrowSize = 10;
  const angle = Math.atan2(dirY, dirX);

  const leftWing = {
    x: fixedEnd.x - arrowSize * Math.cos(angle - Math.PI / 6),
    y: fixedEnd.y - arrowSize * Math.sin(angle - Math.PI / 6)
  };

  const rightWing = {
    x: fixedEnd.x - arrowSize * Math.cos(angle + Math.PI / 6),
    y: fixedEnd.y - arrowSize * Math.sin(angle + Math.PI / 6)
  };

  graphics.fillStyle(color, 1);
  graphics.beginPath();
  graphics.moveTo(fixedEnd.x, fixedEnd.y);
  graphics.lineTo(leftWing.x, leftWing.y);
  graphics.lineTo(rightWing.x, rightWing.y);
  graphics.lineTo(fixedEnd.x, fixedEnd.y);
  graphics.fillPath();
}
