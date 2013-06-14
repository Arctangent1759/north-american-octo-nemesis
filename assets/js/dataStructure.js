/*
Below are three sets of arrays: network output, client, and local cache.
- network output is any data in need of constantly sending from server to client
- client is any data that changes but does not need to be sent to other players (ex. whether you are scoping, since the key presses will be relayed to server and they will adjust your projectile accuracies, but other players don't need to know this bool value)
- local cache is any data that will never ever be changed (except for balancing), and will be stored on the player's computer
This is an unfinished reference document; when you write your functions, use the property and method names here.
If you use a different parameter for the methods (since they are not well defined yet), add to this document, and make a comment of what you changed.
If you decide to add or remove any properties or methods, make a comment of what you changed and why.
Specifically, the client array has not been addressed yet, so needs to be done.
Eventually, what we want to do is, after creating a solid data structure, to make constructor functions for JSON objects with these properties and methods.
Note the spacing; 4 line breaks between the sets of arrays, 1 between the individual arrays, and 1 line break wherever appropriate for organization
*/




NETWORK OUTPUT ARRAY
// data constantly sent over network

playerObject
    .name
    .xPosition
    .yPosition
    .angle
    .health

    .kills
    .deaths
    .ping
    
    .projectile
        .name
        .xPosition[]
        .yPosition[]
        .angle

mapObject
    .cornerAdd[{}, {}, {}, etc.] // there is some serverside function that takes an impact point as input, generated from the physics dept, to determine exactly what points to add and delete to simulate destruction
    .cornerDelete[{}, {}, {}, etc.]

serverObject
    .scoreRed
    .scoreBlue
    .timeLeft

// example

playerObject[0] ==
{
  "name": "William",
  "xPosition": 69,
  "yPosition": 169,
  "angle": 0,
  "health": 69,
  "projectile":
  [
    {
      "name": "bullet",
      "xPosition": [69, 69, 69, 69, 69],
      "yPosition": [189, 209, 229, 249, 269],
      "angle": [0, 0, 0, 0, 0]
    },
    {
      "name": "grenade",
      "xPosition": [100, 110],
      "yPosition": [100, 95],
      "angle": [null, null]
    }
  ]
}

/*
- this playerObject above is a player with name William, location (69, 169), angle of 0 degrees, 69 percent health, in current posession of 5 bullets and 2 grenades on map
- to access the ypos of grenade1
    - playerObject[0].projectile[1].ypos[0]
- according to mothereff.in/byte-counter, this object (with the parentheses and brackets and stuff) is approximately 400 bytes (387)
    - a server of 100 players will have to transmit 40 kilobytes per second to each player
    - if the property identifiers are shortened to characters (instead of full names), we can save about 100 bytes
    - if we remove the formatting, we can save more bytes, but expect a minimum of at least 100 bytes per player
*/




CLIENT ARRAY
// properties that change often but are not sent over network

playerObject
    .name
    .active // bool, if it doesn't exist in network array, then it is false and dead

weaponObject
    .name
    .zoom // right click event

projectileObject
    .name




LOCAL CACHE ARRAY
// fixed data, for reference only

playerObject
    .name
    .link // all link properties are references to img sprites
    .corners[{}, {}, {}, etc.] // each curly brace is supposed to have xPosition: number1, yPosition: number2
    .xOrigin // center point of object, corners are defined relative to this
    .yOrigin
    .collision(object)

    .acceleration
    .moveSpeed
    .turnSpeed(integer) // function based on the sensitivity settings specified by the player

weaponObject
    .name
    .link
    .corners[{}, {}, {}, etc.]
    .xOrigin // point at which projectiles are initialized (to make it seem like actually shooting)
    .yOrigin
    .projectile // will later match to projectileObject.name, only one per weaponObject
    .weight // heavy weapons slow down player
    .collision(object)

    .magazineSize
    .magazineMax
    
    .fire() // create a new projectileObject
    .firingRate // in rounds per second
    .firingModes // single == 1, burst == 2, automatic == 4, firingMode represents sum, so 1 == single, 2 == burst, 3 == single + burst, 4 == automatic, 5 == single + automatic, 6 == burst + automatic, 7 == all modes available
    .firingAccuracy // default accuracy, adjusted by recoil over time
    
    .recoilHip() // logarithmic function of time, approaching limit of inaccuracy
    .recoilSight()
    .recoilScope()
    .scopeTypes // 1, 2, 4, 8, 16, sum represents scopeTypes available; 1 == 1, 2 == 2, 3 == 1 + 2, 4 == 4, 5 == 1 + 4, 6 == 2 + 4, 7 == 1 + 2 + 4, etc.
    
    .reloadRate // in seconds
    .reload()

equipmentObject
    .flashlight()
    .laserSight()
    .nightVision() // invert colors, should be easy as 256 - pixel.color
    .silencer()

projectileObject
    .name
    .link
    .corners[{}, {}, {}, etc.]
    .xOrigin // point to match with weaponObject.xOrigin (and yOrigin) for simulated firing
    .yOrigin
    .collision(object)

    .damage
    .mass // [if we try to implement] determines how far bullet can travel through mapObjects
    .velocity
    .deceleration
    .maxRange // to prevent projectiles going infinitely

    .explosiveRadius // default is 0, single point damage
    .explosiveTimer // how long after impact or 0 velocity the projectile will execute explosion

mapObject
    .name
    .link
    .corners[{xPosition: 0, yPosition: 0}, {xPosition: 0, yPosition: 10}, {xPosition: 10, yPosition: 10}, {xPosition: 10, yPosition: 0}] // sample array of rectangle
    .xOrigin // point at which corners are defined relative to, and also represents object center
    .yOrigin
    .collision(object)
    .cornerAdd(xPosition, yPosition)
    .cornerDelete(xPosition, yPosition) // alternatively, create function editPixels(xPosition, yPosition)