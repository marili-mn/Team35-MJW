// Helpers for object configurations: collision masks, behavior properties and text objects.

// Replaces the collision mask of every frame of a sprite object with one polygon (image coordinates).
export function setSpriteMask(gd, object, points) {
  const anims = gd.asSpriteConfiguration(object.getConfiguration()).getAnimations();
  anims.setAdaptCollisionMaskAutomatically(false);
  let frames = 0;
  for (let a = 0; a < anims.getAnimationsCount(); a++) {
    const anim = anims.getAnimation(a);
    for (let d = 0; d < anim.getDirectionsCount(); d++) {
      const dir = anim.getDirection(d);
      for (let s = 0; s < dir.getSpritesCount(); s++) {
        const sprite = dir.getSprite(s);
        const polys = new gd.VectorPolygon2d();
        const poly = new gd.Polygon2d();
        for (const [x, y] of points) {
          const v = new gd.Vector2f();
          v.set_x(x);
          v.set_y(y);
          poly.getVertices().push_back(v);
        }
        polys.push_back(poly);
        sprite.setFullImageCollisionMask(false);
        sprite.setCustomCollisionMask(polys);
        frames++;
      }
    }
  }
  return frames;
}

export function useFullImageMask(gd, object) {
  const anims = gd.asSpriteConfiguration(object.getConfiguration()).getAnimations();
  for (let a = 0; a < anims.getAnimationsCount(); a++) {
    const anim = anims.getAnimation(a);
    for (let d = 0; d < anim.getDirectionsCount(); d++) {
      const dir = anim.getDirection(d);
      for (let s = 0; s < dir.getSpritesCount(); s++) dir.getSprite(s).setFullImageCollisionMask(true);
    }
  }
}

// Sets behavior properties and returns the values read back, so callers can assert them.
export function setBehaviorProperties(object, behaviorName, values) {
  const behavior = object.getBehavior(behaviorName);
  for (const [k, v] of Object.entries(values)) behavior.updateProperty(k, String(v));
  const props = behavior.getProperties();
  return Object.fromEntries(Object.keys(values).map((k) => [k, props.get(k).getValue()]));
}

// Creates a text object by copying another text object's style, then changing text/size/color.
export function cloneTextObject(gd, project, objects, sourceName, newName, { text = "", size, color } = {}) {
  if (objects.hasObjectNamed(newName)) objects.removeObject(newName);
  const template = new gd.SerializerElement();
  objects.getObject(sourceName).serializeTo(template);
  const obj = objects.insertNewObject(project, "TextObject::Text", newName, objects.getObjectsCount());
  obj.unserializeFrom(project, template);
  const el = new gd.SerializerElement();
  obj.serializeTo(el);
  const content = el.getChild("content");
  el.getChild("string").setStringValue(text);
  content.getChild("text").setStringValue(text);
  if (size) {
    el.getChild("characterSize").setIntValue(size);
    content.getChild("characterSize").setIntValue(size);
  }
  if (color) content.getChild("color").setStringValue(color);
  obj.unserializeFrom(project, el);
  obj.setName(newName);
  return obj;
}
