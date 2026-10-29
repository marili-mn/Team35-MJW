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
        sprite.setFullImageCollisionMask(false);
        sprite.setCustomCollisionMask(polygon(gd, points));
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

const polygon = (gd, points) => {
  const polys = new gd.VectorPolygon2d();
  const poly = new gd.Polygon2d();
  for (const [x, y] of points) {
    const v = new gd.Vector2f();
    v.set_x(x);
    v.set_y(y);
    poly.getVertices().push_back(v);
  }
  polys.push_back(poly);
  return polys;
};

// Image names of every frame of a sprite object, animation by animation: { animName: [image, ...] }.
export function spriteFrames(gd, object) {
  const anims = gd.asSpriteConfiguration(object.getConfiguration()).getAnimations();
  const out = [];
  for (let a = 0; a < anims.getAnimationsCount(); a++) {
    const dir = anims.getAnimation(a).getDirection(0);
    for (let s = 0; s < dir.getSpritesCount(); s++) out.push(dir.getSprite(s).getImageName());
  }
  return out;
}

// Replaces all animations of a sprite object. anims: [{ name, images, speed, loop }]; every frame gets
// the same origin and collision mask (null mask = full image).
export function setAnimations(gd, object, anims, { origin = [0, 0], mask = null } = {}) {
  const list = gd.asSpriteConfiguration(object.getConfiguration()).getAnimations();
  list.removeAllAnimations();
  list.setAdaptCollisionMaskAutomatically(false);
  for (const { name, images, speed = 0.08, loop = true } of anims) {
    const anim = new gd.Animation();
    anim.setName(name);
    anim.setDirectionsCount(1);
    const dir = anim.getDirection(0);
    dir.setLoop(loop);
    dir.setTimeBetweenFrames(speed);
    for (const image of images) {
      const sp = new gd.Sprite();
      sp.setImageName(image);
      sp.getOrigin().setXY(origin[0], origin[1]);
      if (mask) {
        sp.setFullImageCollisionMask(false);
        sp.setCustomCollisionMask(polygon(gd, mask));
      } else sp.setFullImageCollisionMask(true);
      dir.addSprite(sp);
    }
    list.addAnimation(anim);
  }
}

// Registers an image file of the game folder as a resource (named after its path) if needed.
export function ensureImageResource(gd, project, file) {
  const rm = project.getResourcesManager();
  if (!rm.hasResource(file)) {
    const r = new gd.ImageResource();
    r.setName(file);
    r.setFile(file);
    r.setSmooth(false);
    rm.addResource(r);
  }
  return file;
}

// Serializes an object so it can be re-created in another scene (see insertObjectFrom).
export function serializeObject(gd, object) {
  const el = new gd.SerializerElement();
  object.serializeTo(el);
  return { type: object.getType(), element: el };
}

export function insertObjectFrom(gd, project, objects, name, { type, element }) {
  if (objects.hasObjectNamed(name)) objects.removeObject(name);
  const obj = objects.insertNewObject(project, type, name, objects.getObjectsCount());
  obj.unserializeFrom(project, element);
  obj.setName(name);
  return obj;
}

export function declareObjectNumbers(object, names) {
  const vars = object.getVariables();
  for (const n of names) if (!vars.has(n)) vars.insertNew(n, vars.count()).setValue(0);
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
