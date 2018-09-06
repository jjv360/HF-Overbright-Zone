

/*********************************
 **          Polyfills          **
 *********************************/

/** function.bind() polyfill */
if (!Function.prototype.bind) {
  Function.prototype.bind = function(oThis) {
    if (typeof this !== 'function') {
      // closest thing possible to the ECMAScript 5
      // internal IsCallable function
      throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
    }

    var aArgs   = Array.prototype.slice.call(arguments, 1),
        fToBind = this,
        fNOP    = function() {},
        fBound  = function() {
          return fToBind.apply(this instanceof fNOP
                 ? this
                 : oThis,
                 aArgs.concat(Array.prototype.slice.call(arguments)));
        };

    if (this.prototype) {
      // Function.prototype doesn't have a prototype property
      fNOP.prototype = this.prototype;
    }
    fBound.prototype = new fNOP();

    return fBound;
  };
}
















/**************************************
 **          Lighting class          **
 **************************************/


 /** The Lighting class exposes an instance which can be shared across multiple scripts, to request smooth lighting
  *  changes to the environment. This is useful, for example in having a bright outdoor environment, then transitioning
  *  to a dark indoor environment. We can then make the exposure and other renderer attributes smoothly interpolate.
  *
  *  This is a singleton, so don't use the constructor. Use `Lighting.shared.<function>` instead.
  *
  *  @private
  *  @class
  *  @hideconstructor
  */
function Lighting() {

    // Set the frame rate of all changes
    this.durationBetweenFrames = 1000 / 60

    // Exposure settings
    this.exposureSpeedChange = 0.02
    this.exposureTimer = null

    // The zones the user is currently inside of
    this.zones = []

}

 /**
  *  The shared attribute. Use this to access the class instance.
  *
  *  @memberof Lighting
  *  @static
  *  @type {Lighting}
  */
Object.defineProperty(Lighting, "shared", {
    get: function() {

        // Check if shared instance exists yet
        var global = (function() { return this })()
        if (global._sharedLighting)
            return global._sharedLighting

        // It doesn't, create it
        global._sharedLighting = new Lighting()
        return global._sharedLighting

    }
})

 /**
  *  Registers a zone that the user is inside of, and it's associated lighting properties.
  *
  *  @param {string} id The zone entity ID
  *  @param {number} size The zone size. Used to determine which zone's lighting to use.
  *  @param {Object} props Lighting properties
  */
Lighting.prototype.enteredZone = function(id, size, props) {

    // If we're adding the first zone, enable the render options
    if (this.zones.length == 0) {

        // Setup environment
        Render.getConfig("RenderMainView").getConfig("Bloom").enabled = true
        Render.getConfig("RenderMainView").getConfig("Bloom").intensity = 1
        Render.getConfig("RenderMainView").getConfig("BloomThreshold").threshold = 0
        Render.getConfig("RenderMainView").getConfig("Bloom").size = 0.7
        Render.getConfig("RenderMainView").getConfig("ToneMapping").enable = true
        Render.getConfig("RenderMainView").getConfig("ToneMapping").curve = 1

    }

    // Remove existing, if any
    for (var i = 0 ; i < this.zones.length ; i++)
        if (this.zones[i].id == id)
            this.zones.splice(i--, 1)

    // Add this zone
    this.zones.push({
        id: id,
        size: size,
        properties: props || {}
    })

    // Sort zones smallest to biggest
    this.zones.sort(function(a, b) {
        return a.size - b.size
    })

    // Update lighting
    this.updateLighting()

}

 /**
  *  Unregisters a zone. Call this when the user leaves the zone.
  *
  *  @param {string} id The zone entity ID
  */
Lighting.prototype.exitedZone = function(id) {

    // Remove it, if it exists
    for (var i = 0 ; i < this.zones.length ; i++)
        if (this.zones[i].id == id)
            this.zones.splice(i--, 1)

    // If we have no more lighting-enabled zones, reset the render options to default
    if (this.zones.length == 0) {

        // Setup environment
        Render.getConfig("RenderMainView").getConfig("Bloom").enabled = false
        Render.getConfig("RenderMainView").getConfig("Bloom").intensity = 0
        Render.getConfig("RenderMainView").getConfig("BloomThreshold").threshold = 1
        Render.getConfig("RenderMainView").getConfig("Bloom").size = 0.25
        Render.getConfig("RenderMainView").getConfig("ToneMapping").enable = true
        Render.getConfig("RenderMainView").getConfig("ToneMapping").curve = 1
        Render.getConfig("RenderMainView").getConfig("ToneMapping").exposure = 0

        // Cancel existing timer if any
        if (this.exposureTimer)
            Script.clearInterval(this.exposureTimer)

        return

    }

    // Update lighting
    this.updateLighting()

}

 /**
  *  Gets a value as specified by the current zone(s).
  *
  *  @private
  *  @param {string} key The property name
  *  @param {any} defaultValue The default value, if none specified in the current zone(s)
  *  @returns {any} The zone property value
  */
Lighting.prototype.getValue = function(key, defaultValue) {

    // Go through each zone (which has already been sorted smallest to largest)
    for (var i = 0 ; i < this.zones.length ; i++) {

        // Check if property exists
        var zone = this.zones[i]
        var value = zone.properties[key]
        if (typeof value == "undefined")
            continue

        // Exists, use it
        return value

    }

    // Property not specified in any of the zones the user is inside of, use the default
    return defaultValue

}

 /**
  *  Updates the lighting based on the current zone(s)
  *
  *  @private
  */
Lighting.prototype.updateLighting = function() {

    // Update lighting values
    this.setExposure(this.getValue("exposure", 0))

}

 /**
  *  Smoothly sets the exposure level of the renderer.
  *
  *  @private
  *  @param {number} targetExposure The desired new exposure level
  */
Lighting.prototype.setExposure = function(targetExposure) {

    // Stop if Render doesn't exist
    if (typeof Render == "undefined")
        return

    // Cancel existing timer if any
    if (this.exposureTimer)
        Script.clearInterval(this.exposureTimer)

    // Get current exposure
    var currentExposure = Render.getConfig("RenderMainView").getConfig("ToneMapping").exposure

    // Start the timer
    this.exposureTimer = Script.setInterval(function() {

        // Update exposure
        if (currentExposure > targetExposure)
            currentExposure -= this.exposureSpeedChange
        else if (currentExposure < targetExposure)
            currentExposure += this.exposureSpeedChange

        // Check if we're done
        if (Math.abs(currentExposure - targetExposure) < this.exposureSpeedChange * 2) {

            // We're done, cancel the timer
            currentExposure = targetExposure
            Script.clearInterval(this.exposureTimer)
            this.exposureTimer = null

        }

        // Update renderer values
        Render.getConfig("RenderMainView").getConfig("ToneMapping").exposure = currentExposure

    }.bind(this), this.durationBetweenFrames)

}

































 /*************************************************
  **          DynamicLightingZone class          **
  *************************************************/


/**
 *  Utility function, reads user data from the entity properties.
 *
 *  @param {string} entityID The entity ID to read from.
 *  @returns {Object} The entity's user data.
 */
function getUserData(entityID, name) {

    // Catch errors
    try {

        // Get userData string
        var str = Entities.getEntityProperties(entityID, ["userData"]).userData

        // Parse as JSON and return it
        return JSON.parse(str) || {}

    } catch (err) {

        // Error, just return an empty object
        return {}

    }

}

/**
 *  This class manages the interaction with the zone.
 *
 *  @class
 */
function DynamicLightingZone() {

}

/**
 *  Called by HF when the entity is loaded
 *
 *  @private
 */
DynamicLightingZone.prototype.preload = function(id) {

    // Store our ID
    this.id = id

    //
    print('[DynamicLightingZone] Loaded')

    // Check if we're actually already inside this entity
    var zoneProps = Entities.getEntityProperties(this.id, ["position", "dimensions"])
    if (MyAvatar.position.x > zoneProps.position.x - zoneProps.dimensions.x/2 && MyAvatar.position.x < zoneProps.position.x + zoneProps.dimensions.x/2
     && MyAvatar.position.y > zoneProps.position.y - zoneProps.dimensions.y/2 && MyAvatar.position.y < zoneProps.position.y + zoneProps.dimensions.y/2
     && MyAvatar.position.z > zoneProps.position.z - zoneProps.dimensions.z/2 && MyAvatar.position.z < zoneProps.position.z + zoneProps.dimensions.z/2) {

        // We are already inside the entity, trigger event
        this.enterEntity(this.id)

    }

}

/**
 *  Called by HF when the entity is unloaded
 *
 *  @private
 */
DynamicLightingZone.prototype.unload = function(id) {

    // Check ID
    if (id != this.id)
        return

    // Notify lighting class
    Lighting.shared.exitedZone(this.id)

}

/**
 *  Called by HF when the user goes inside our entity
 *
 *  @private
 */
DynamicLightingZone.prototype.enterEntity = function(id) {

    // Check ID
    if (id != this.id)
        return

    // Get our size
    var dimensions = Entities.getEntityProperties(this.id, ["dimensions"]).dimensions

    // Notify lighting class
    Lighting.shared.enteredZone(this.id, dimensions.x + dimensions.y + dimensions.z, getUserData(this.id).lighting)

}

/**
 *  Called by HF when the user goes outside our entity
 *
 *  @private
 */
DynamicLightingZone.prototype.leaveEntity = function(id) {

    // Check ID
    if (id != this.id)
        return

    // Notify lighting class
    Lighting.shared.exitedZone(this.id)

}


// Return our class
;(DynamicLightingZone)
