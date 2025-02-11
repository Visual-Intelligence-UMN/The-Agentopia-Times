export function createItem(this: any, group: any, x: number, y: number, texture: any, scaleFactor = 0.25) {
    const item = group.create(x, y, texture).setScale(scaleFactor);
    this.physics.world.enable(item);

    const { width, height } = item;
    item.body.setSize(width * scaleFactor, height * scaleFactor);
    item.body.setOffset(
        (width - width * scaleFactor) / 2, 
        (height - height * scaleFactor) / 2
    );
}





