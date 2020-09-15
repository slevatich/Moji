// World Values
var dim: int = 20;              // dimension of the height map
var max: float = 8;             // max height
var ground: float = 0;          // min height
var step: float = 4;            // distance between height map points
var interp: int = 4;            // Levels of interpolation between the height map points
var difficultyMode: int = 0;    // Picks the correct difficulty
var numOverhangs: int = 2;      // Number of overhangs on the map
var numRocks: int = 6;          // Number of rocks on the map
var numPlatforms: int = 2;      // Number of platforms on the map
var numWaveys: int = 3;         // Number of wavy places
var waveySize: int = 5;         // How large should wavies be
var numPlatWaveys: int = 1;     // Number of platform lava challenges

// World Booleans
var playAudio: boolean = false; // Do we play game loop audio
var userDraw: boolean = true;   // Does user get to draw?
var showTime: boolean = false;  // Shows a time meter for the user

// World GameObjects
var canvas: GameObject;         // The canvas
var image: GameObject;          // The image in the canvas to draw on
var player: GameObject;         // The player container
var instructions: GameObject;   // The how to draw instructions

// World Prefabs
var reward: GameObject;         // Reward Prefab
var rock: GameObject;           // Rock Prefab
var reward2: GameObject;        // Opt Reward Prefab

// Material Stuff
var quiltMat: Material;         // Base Material
var plainMat: Material;         // Material for water

var groundColor: Color = Color(0,1,0,1);
var mountainColor: Color = Color(1,0,0,1);
var lakeColor: Color = Color(0,0,1,1);
var platColor: Color = Color(1,1,1,1);
var matFac: float = 0.5;

var lakeWaveys: Array = new Array();

var platformMesh: GameObject;   // Prefab of platform mesh container
var deathCollider: GameObject;  // Prefab of death trigger zones

/*  NOTES ******************
    The overall game board will center at 0,0 and have dimensions of dim-1 * step in a square.
    Interp doesn't effect distance. step affects smoothness to some degree? if it doesnt vary with interp
    Ultimately vertices.length will be ((dim - 1) * interp)^2
    Step is divided by interp to get the actual distance between verts
    ------
    i == x and j == z
    This means the map moves from -x,-z in upper left corner down to the right, from drawing view
    Note that textures are stored from the bottom so theres a flip in colormap gen
    We start facing negative x (up) with Z to the right of us
    ------
    Colormap:
    1: mountains
    2: grass
    3: lakes
    4: overhangs
    5: platforms
    6: rocks
    7: waveys (lava)
    ------
    Ideally,
    step == interp (so the squares are 1x1 in world units)
    height = .15 * dim * step
    more importantly, height should be about 2 * step
    you can change step freely without affecting how many verts there are, but be wary of height
    (which maxes out at 18 really)
    step does screw up overhangs though. thats the biggest result of step != interp
    ------
    Function order:
    -Hidden Rewards
    -Waveys
    -Jumpies
    -Platforms
    -Overhangs
    -Terrain (includes Colormap)
    -Start/Update
    -Utility
*/

// Assorted values
private var vertices: Vector3[];        // the list of vertices
private var verticesInfo: boolean[];    // adtn info for vertices
private var text: Texture2D;            // keeps track of user generated textures
private var color: Color = Color.blue;  // color of brush
private var brush: int = 6;             // size of the brush
private var colormap: int[];            // the colormap: used between functions so we don't generate each time
private var mesh: Mesh;                 // the actual mesh itself
private var rewardCount: int = 0;       // the amount of rewards in play
private var overHangLen: int = 8;       // how long are overhangs
private var hangRewardDiff: float = .5; // how far back rewards are from the overhang tip
private var wegood: boolean = false;    // whether the terrain has been drawn (for update)
private var mcoll: MeshCollider;        // the mesh collider

// Difficulty functions
private var diff_func_height: float[];
private var diff_func_width: float[];
private var diff_func_dist: int[];
private var diff_func_reward: int[];

// Wave Space Stuff
private var waveDim: int[];
private var waveStartI: int[];
private var waveStartJ: int[];
private var waveInit: Array[];
private var wavePlat: boolean[];

// Material types
private var groundMat: Material;        // Ground Material
private var mountainMat: Material;      // Mountain Material
private var lakeMat: Material;          // Lake Material

private var notplayed: boolean = true;  // Have we not achieved all the rewards???
private var fanfare: AudioSource;
private var timeElapsed: float = 0.0;



/******** Exploratoriummmmm ********/


function LetsStartAHunt() {
    var arrAngles = new Array();
    var arrPoints = new Array();
    var count = 0;

    // dim is different
    var square_rad = (dim - 1) * step;
    var hitInfo:RaycastHit;

    // spiral out from the center casting rays
    for (var i=0; i<360; i+=2) {
        // cast a vector at this amount of degrees
        var radian = i / 180.0 * Mathf.PI;
        var vec = Vector3(Mathf.Cos(radian),0,Mathf.Sin(radian));
        
        if (Physics.Raycast(Vector3(0,3,0), vec, hitInfo, square_rad)) {
            if (Random.value < .1) {
                arrAngles.Push(vec);
                arrPoints.Push(hitInfo.point);
                count++;
            }
        }
    }

    // now march along in the parallel arrays and put a reward at each point
    for (i=0; i<count; i++) {
        var x = arrAngles[i].x;
        var z = arrAngles[i].z;
        var vecEnd: Vector3;
        if (Mathf.Abs(x) < Mathf.Abs(z)) {
            // the bigger edge is some percentage of dim*step*interp/2 so scale that to that
            if (z < 0) {
                vecEnd = Vector3((square_rad/(2.0*Mathf.Abs(z))) * x,0,-1*square_rad/2.0);
            } else {
                vecEnd = Vector3((square_rad/(2.0*Mathf.Abs(z))) * x,0,square_rad/2.0);
            }
        } else {
            if (x < 0) {
                vecEnd = Vector3(-1 * square_rad/2.0,0,(square_rad/(2.0*Mathf.Abs(x))) * z);
            } else {
                vecEnd = Vector3(square_rad/2.0,0,(square_rad/(2.0*Mathf.Abs(x))) * z);
            }
        }

        // now go from point to vec end in some steps of vec
        var newArr = new Array();
        var point = arrPoints[i] + square_rad / 20.0 * arrAngles[i];

        while (Mathf.Abs(point.x) < (square_rad * .9) / 2.0 && Mathf.Abs(point.z) < (square_rad * .9) / 2.0) {
            newArr.Push(point);
            point += square_rad / 20.0 * arrAngles[i];
        }

        // Find lowest point in the ray past whatever geometry it hit
        var cur_min = Vector3(0,max,0);
        for (var j=0; j<newArr.length; j++) {
            if (Physics.Raycast(Vector3(newArr[j].x,max,newArr[j].z), Vector3.down, hitInfo, max*2)) {
                if (hitInfo.point.y < cur_min.y) {
                    cur_min = hitInfo.point;
                }
            }
        }

        // Put a reward there
        if (cur_min.x != 0 && cur_min.z != 0) {
            AddReward(cur_min+Vector3(0,1,0));
        }
    }
}


/******** ~~~WAVVY~~~ ********/

// Edits colormap so the space is secured
function ReserveWaveSpace(largeness:int) {
    // Grid dim refers to our search grid
    var grid_dim = largeness;

    var grid_start_x = 0;
    var grid_start_z = 0;
    var grid_dim_x = grid_dim;
    var grid_dim_z = grid_dim;

    // This the entire object of the next bit
    // we search less vertices overall since we are using a window: don't want to go over edges!
    var search_dim_x = dim - (grid_dim_x - grid_start_x) - interp;
    var search_dim_z = dim - (grid_dim_z - grid_start_z) - interp;
    // This is for colormap values
    var color_dim = Mathf.Sqrt(colormap.length);
    var relArray = new Array();
    var rel_i = 0;
    var rel_j = 0;
    var allsgood = false;
    for (var i=interp; i< search_dim_x; i++) {
        for (var j=interp; j< search_dim_z; j++) {
            if (vertices[i*dim + j].y < 1 && vertices[i*dim + j].y > -1) {
                // we have hit a grass point! check that the rest of the square is grass
                allsgood = true;
                for (var ii = i; ii < i+(grid_dim_x-grid_start_x); ii++) {
                    for (var jj = j; jj < j+(grid_dim_z-grid_start_z); jj++) {
                        if (vertices[ii*dim + jj].y <= -1 || vertices[ii*dim + jj].y >= 1 || colormap[(ii/interp)*color_dim + (jj/interp)] != 2) {
                            allsgood = false;
                        }
                    }
                }
                if (allsgood) {
                    relArray.push(Vector2(i-grid_start_x,j-grid_start_z));
                }
            }
        }
    }

    if (relArray.length == 0) {
        Debug.Log("No wave space could be placed");
        return null;
    }

    // Comment appropriately for random choice or just the first choice for testing
    var rel_vec: Vector2 = relArray[Mathf.Floor(Random.value*relArray.length)];
    // var rel_vec: Vector2 = relArray[0];
    rel_i = rel_vec.x;
    rel_j = rel_vec.y;

    // Mapped!
    for (i=rel_i+grid_start_x; i < rel_i+grid_dim_x; i++) {
        for (j=rel_j+grid_start_z; j < rel_j+grid_dim_z; j++) {
            colormap[(i/interp)*color_dim + (j/interp)] = 7; // 7 is wavespace
            verticesInfo[i*dim+j] = true;
            if (i > rel_i+grid_start_x && i < rel_i+grid_dim_x - 1 && j > rel_j+grid_start_z && j < rel_j+grid_dim_z - 1) {
                vertices[i*dim+j].y = -10;
            } else {
                vertices[i*dim+j].y = 0;
            }
        }
    }

    return Vector2(rel_i,rel_j);
}

// Sets up space
function InitWaveys() {
    for (var k=0; k<numWaveys+numPlatWaveys; k++) {
        var start_i = waveStartI[k];
        var start_j = waveStartJ[k];
        waveInit[k] = new Array();

        for (var i=1; i<waveDim[k]-1; i++) {
            for (var j=1; j<waveDim[k]-1; j++) {
                waveInit[k].Push(Random.value * 3);
            }
        }
        // creates a death zone below
        var death = Instantiate(deathCollider, Vector3(vertices[start_i*dim+start_j].x,-0.5,vertices[start_i*dim+start_j].z),Quaternion.identity);
        death.transform.localScale = Vector3(waveDim[k]-1,1,waveDim[k]-1); // scales in only one direction due to pivot

        // Are we generating a wave with platforms on it?
        if (wavePlat[k]) {
            // grabbed from the platform gen function
            var grid_dim = Mathf.Ceil(13.3333 * 4/3.0);
            var cell_len = 13.3333 / 3.0;

            // These are all the endpoints of our grid
            var a = vertices[start_i*dim+start_j].x;
            var b = vertices[start_i*dim+start_j].x+grid_dim;
            var c = vertices[start_i*dim+start_j].z;
            var d = vertices[start_i*dim+start_j].z+grid_dim;

            // our grid is still square only
            var numCells = Mathf.Floor((b - a) / (cell_len)); // how many cells we can have (approx)

            var theMatrix: Vector3[] = new Vector3[numCells * numCells];
            // Now we construct the array, which is max jump / 3 apart for numCell times
            for (i=0; i<numCells; i++) {
                for (j=0; j<numCells; j++) {
                    theMatrix[i*numCells + j] = Vector3(a + cell_len*i+0.5*cell_len,1,c + cell_len*j+0.5*cell_len);
                    addPlatformToMesh(theMatrix[i*numCells + j].x,theMatrix[i*numCells + j].z,2,2);
                }
            }

            // Rewards are on diagonals
            AddOptReward(Vector3((b+a)/2.0,6,(d+c)/2.0));
            AddReward(Vector3((3*b+a)/4.0,5,(d+c)/2.0));
            AddReward(Vector3((b+3*a)/4.0,5,(d+c)/2.0));
            AddReward(Vector3((b+a)/2.0,5,(3*d+c)/4.0));
            AddReward(Vector3((b+a)/2.0,5,(d+3*c)/4.0));
        }
    }
}

// Moves the lava in periodic motion with some ~randomness~
function UpdateWaveys() {
    for (var k=0; k<numWaveys+numPlatWaveys; k++) {
        var start_i = waveStartI[k];
        var start_j = waveStartJ[k];

        var count = 0;
        for (var i=1; i<waveDim[k]-1; i++) {
            for (var j=1; j<waveDim[k]-1; j++) {
                waveInit[k][count] = waveInit[k][count] + 4*Time.deltaTime;
                vertices[(start_i+i)*dim+(start_j+j)].y = 0.2 * Mathf.Cos(waveInit[k][count]);
                count++;
            }
        }

        for(i=start_i; i<start_i+waveDim[k]-1; i++) {
            temp = i * dim;
            for(j=start_j; j<start_j+waveDim[k]-1; j++) {
                var avg = vertices[temp+j].y + vertices[temp+j+1].y + vertices[temp+j+dim].y + vertices[temp+j+dim+1].y;
                avg = avg / 4.0;
                vertices[dim*dim + i*(dim-1) + j].y = avg;
            }
        }
    }
}

// var lakeWaveInit: Array;

// function InitLakeWaveys() {
//     lakeWaveInit = new Array();
//     for (var i=0; i<lakeWaveys.length; i++) {
//         lakeWaveInit.Push(Random.value*3);
//         vertices[lakeWaveys[i]].y = -10; // this adjusts the mesh collider levels
//     }
// }

// function UpdateLakeWaveys() {
//     for (var i=0; i<lakeWaveys.length; i++) {
//         lakeWaveInit[i] = lakeWaveInit[i] + (Random.value*2+3)*Time.deltaTime;
//         vertices[lakeWaveys[i]].y = -1 + 0.2 * Mathf.Cos(lakeWaveInit[i]);
//     }

//     for (k=0; k<lakeWaveys.length; k++) {
//         i = lakeWaveys[k] / dim;
//         temp = i * dim;
//         j = lakeWaveys[k] % dim;
//         var avg = vertices[temp+j].y + vertices[temp+j+1].y + vertices[temp+j+dim].y + vertices[temp+j+dim+1].y;
//         avg = avg / 4.0;
//         vertices[dim*dim + i*(dim-1) + j].y = avg;
//         // Figure out the rest of the stuff
//         // avg = vertices[temp+j].y + vertices[temp+j-1].y + vertices[temp+j+dim].y + vertices[temp+j+dim-1].y
//         // avg = avg / 4.0;
//         // vertices[dim*dim + i*(dim-1) + j].y = avg;
//     }
// }




/*******************  JUST SOME ROCKS (Just kidding they bounce) *******************/

function GenerateRocks(numRocks:int) {
    for (var w=0; w< numRocks; w++) {
        // THIS determines how big my bunches of platforms are. maybe expose this?
        var platform_grid_size = 8.0; // This should be nice and even

        // grid_dim is the amount of vertices of the color map that will be included in my grid
        // This says I want the max dimension of my platform 'area' to be about twice as long as my max jump
        // Should this be ceiling?
        var grid_dim = Mathf.Ceil(platform_grid_size / (step * interp));

        // color_dim is orig_dim: it allows for mapping a color onto vertices
        // This the entire object of the next bit
        var color_dim = Mathf.Sqrt(colormap.length);
        // we search less vertices overall since we are using a square window: don't want to go over edges!
        var search_dim = color_dim - grid_dim - 1;
        var relArray = new Array();
        var relevant_i = 0;
        var relevant_j = 0;
        var allsgood = false;
        for (var i=1; i< search_dim; i++) {
            for (var j=1; j< search_dim; j++) {
                if (colormap[i*color_dim + j] == 2) {
                    // we have hit a grass point! check that the rest of the square is grass
                    allsgood = true;
                    for (var ii = i; ii < i+grid_dim; ii++) {
                        for (var jj = j; jj < j+grid_dim; jj++) {
                            if (colormap[ii*color_dim + jj] != 2) {
                                allsgood = false;
                            }
                        }
                    }
                    if (allsgood) {
                        relArray.push(Vector2(i,j));
                    }
                }
            }
        }

        Debug.Log("How many options for rocks: " + relArray.length);
        if (relArray.length == 0) {
            Debug.Log("No rocks could be placed");
            return;
        }
        // Comment appropriately for random choice or just the first choice for testing
        var rel_vec: Vector2 = relArray[Mathf.Floor(Random.value*relArray.length)];
        // var rel_vec: Vector2 = relArray[0];
        relevant_i = rel_vec.x;
        relevant_j = rel_vec.y;

        // Change the color map to 6 in all these spots
        for (i=relevant_i; i < relevant_i+grid_dim; i++) {
            for (j=relevant_j; j < relevant_j+grid_dim; j++) {
                colormap[i*color_dim + j] = 6; // set them all to occupied
            }
        }

        // Converts the color map indices into real indices
        relevant_i = (relevant_i - (color_dim - 1) / 2.0) * step * interp;
        relevant_j = (relevant_j - (color_dim - 1) / 2.0) * step * interp;

        var vec = Vector3(relevant_i+platform_grid_size/2.0, 0, relevant_j+platform_grid_size/2.0);
        Instantiate(rock, vec, Quaternion.identity);

        // Adds rewards above the bouncies
        AddReward(vec + Vector3(0,15,0));
        AddReward(vec + Vector3(0,13,0));
        AddReward(vec + Vector3(0,11,0));
        AddReward(vec + Vector3(0,4,0));
    }
}


/*******************  PLATFORMS TAKES FOREVERRRRRRR *******************/

// Similar to reserving wavespace: marks colormap
function PrepPlatforms (numPlatforms:int) {
    var platformArray: Vector2[] = new Vector2[numPlatforms];
    for (var w=0;w<numPlatforms;w++) {
        // These probably could be determined programatically... but easier to use as constants since I did the math
        var max_jump_height = 3.33333;
        var max_jump_length = 13.3333;

        // THIS determines how big my bunches of platforms are. maybe expose this?
        var platform_grid_size = max_jump_length * 2;

        // grid_dim is the amount of vertices of the color map that will be included in my grid
        // This says I want the max dimension of my platform 'area' to be about twice as long as my max jump
        // Should this be ceiling?
        var grid_dim = Mathf.Ceil(platform_grid_size / (step * interp));

        // color_dim is orig_dim: it allows for mapping a color onto vertices
        // This the entire object of the next bit
        var color_dim = Mathf.Sqrt(colormap.length);
        // we search less vertices overall since we are using a square window: don't want to go over edges!
        var search_dim = color_dim - grid_dim - 1;
        var relArray = new Array();
        var relevant_i = 0;
        var relevant_j = 0;
        var allsgood = false;
        for (var i=1; i< search_dim; i++) {
            for (var j=1; j< search_dim; j++) {
                if (colormap[i*color_dim + j] == 2) {
                    // we have hit a grass point! check that the rest of the square is grass
                    allsgood = true;
                    for (var ii = i; ii < i+grid_dim; ii++) {
                        for (var jj = j; jj < j+grid_dim; jj++) {
                            if (colormap[ii*color_dim + jj] != 2) {
                                allsgood = false;
                            }
                        }
                    }
                    if (allsgood) {
                        relArray.push(Vector2(i,j));
                    }
                }
            }
        }

        Debug.Log("How many options for platforms: " + relArray.length);
        if (relArray.length == 0) {
            Debug.Log("No platforms could be placed");
            return;
        }
        // Comment appropriately for random choice or just the first choice for testing
        var rel_vec: Vector2 = relArray[Mathf.Floor(Random.value*relArray.length)];
        // var rel_vec: Vector2 = relArray[0];
        relevant_i = rel_vec.x;
        relevant_j = rel_vec.y;

        // Change the color map to 3 in all these spots
        for (i=relevant_i; i < relevant_i+grid_dim; i++) {
            for (j=relevant_j; j < relevant_j+grid_dim; j++) {
                colormap[i*color_dim + j] = 5; // set them all to occupied
            }
        }

        platformArray[w] = rel_vec;
    }
    return platformArray;
}

// This creates a quilt platform based on position, height, and width
function addPlatformToMesh(x:float,z:float,h:float,r:float) {
    var pM: GameObject = Instantiate(platformMesh,Vector3(0,0,0),Quaternion.identity) as GameObject;

    var mr = pM.GetComponent.<MeshRenderer>();
    var mf = pM.GetComponent.<MeshFilter>();
    var mc = pM.GetComponent.<MeshCollider>();
    var platmesh = new Mesh();
    mf.mesh = platmesh;
    var platVerts = new Array(); // will only hold Vector3: need to convert later

    var iWidth: int  = Mathf.Floor(r);
    var iHeight: int = Mathf.Floor(h);
    if (iWidth == 0) {
        iWidth = 1;
        iHeight *= 2;
    }

    var curX: float = (x - r / 2.0);
    var curZ: float = (z - r / 2.0);
    var curY: float = 0;
    var factor = r / (iWidth * 1.0);
    var factor2 = h / (iHeight * 1.0);
    curY -= factor2;

    // value added should go linearly to h-1 varying with r (certain percentage)
    var maxValAdd = r * 0.15; // 20%
    var incrValAdd = maxValAdd / (iHeight - 1.0);
    var valueAdded = 0.0;
    valueAdded -= incrValAdd;

    // first advance in x, then z, then backtrack x, then backtrack z
    for (var j=0; j<=iHeight; j++) {
        var randomFactor = 8.0;
        valueAdded += incrValAdd;
        if (j == iHeight) {
            valueAdded = 0.0; // final is original width, with a wider lower lip 
        }
        var randomShift = -0.5/randomFactor;
        curY += factor2;
        platVerts.Push(Vector3(curX,curY,curZ));
        for (var i=0; i<iWidth; i++) {
            curX += factor;
            platVerts.Push(Vector3(curX,curY,curZ-(Random.value/randomFactor + randomShift + valueAdded)));
        }
        for (i=0; i<iWidth; i++) {
            curZ += factor;
            platVerts.Push(Vector3(curX+(Random.value/randomFactor + randomShift + valueAdded),curY,curZ));
        }
        for (i=0; i<iWidth; i++) {
            curX -= factor;
            platVerts.Push(Vector3(curX,curY,curZ+(Random.value/randomFactor + randomShift + valueAdded)));
        }
        for (i=0; i<iWidth; i++) {
            curZ -= factor;
            if (i==iWidth-1) {
                // This makes the thing loop to account for adjustments
                platVerts.Push(platVerts[platVerts.length-(4*iWidth)]);
            } else {
                platVerts.Push(Vector3(curX-(Random.value/randomFactor + randomShift + valueAdded),curY,curZ));
            }
        }
    }
    
    factor = r / (iWidth * 1.0);

    // Start and end of the final ring of verts: enables proper setting of the top mesh
    var end = platVerts.length; // len is the max
    var start = iHeight * (iWidth * 4 + 1);

    // Now add the top segment: should go off the first panel
    for (i=1; i <= iWidth; i++) {
        for(j=0; j <= iWidth; j++) {
            if (j==0) {
                platVerts.Push(platVerts[end-1-i]);
            } else if (j == iWidth) {
                platVerts.Push(platVerts[start + iWidth + i]);
            } else if (i == iWidth) {
                platVerts.Push(platVerts[end-1-iWidth-j]);
            } else {
                platVerts.Push(Vector3((x - r / 2.0) + j * factor,curY+0.2+Random.value*0.05,(z - r / 2.0) + i * factor));
            }
        }
    }

    platmesh.vertices = platVerts.ToBuiltin(Vector3) as Vector3[];

    var numMaterials = 3;

    var triArray: Array[] = new Array[numMaterials];
    for (i=0; i<numMaterials; i++) {
        triArray[i] = new Array();
    }

    var tri = new Array();

    platMat = new Material(quiltMat);

    platMat.color = platColor;
    var pc = platColor;
    var platMatLight = new Material(quiltMat);
    platMatLight.color = Color(pc.r + ((1 - matFac) * (1 - pc.r)), 
                                 pc.g + ((1 - matFac) * (1 - pc.g)), 
                                 pc.b + ((1 - matFac) * (1 - pc.b)), 1);
    var platMatDark = new Material(quiltMat);
    platMatDark.color = Color(pc.r * matFac, pc.g * matFac, pc.b * matFac, 1);

    // Change materials to all tile properly
    platMat.mainTextureScale = Vector2((iWidth*4),(iWidth*4));
    platMatLight.mainTextureScale = Vector2((iWidth*4),(iWidth*4));
    platMatDark.mainTextureScale = Vector2((iWidth*4),(iWidth*4));

    // mesh renderer add elements to the materials array
    var materials: Material[] = new Material[numMaterials];
    materials[0] = platMat;
    materials[1] = platMatLight;
    materials[2] = platMatDark;
    platmesh.subMeshCount = numMaterials;

    for (i=1; i<=iHeight; i++) {
        for (j=0; j < iWidth * 4; j++) {
            choice = Mathf.Floor(Random.value*3);
            if (choice < 1) {
                tri = triArray[0];
            } else if (choice == 2) {
                tri = triArray[1];
            } else {
                tri = triArray[2];
            }
            tri.Push(j+(i)  *(iWidth*4+1)+1);
            tri.Push(j+(i-1)*(iWidth*4+1)+1);
            tri.Push(j+(i-1)*(iWidth*4+1));

            tri.Push(j+i*(iWidth*4+1));
            tri.Push(j+i*(iWidth*4+1)+1);
            tri.Push(j+(i-1)*(iWidth*4+1));
        }
    }

    // Now do the top lip, which is a mapping from start + 0-4 to end + 0-4
    for (i=0; i<iWidth; i++) {
        choice = Mathf.Floor(Random.value*3);
        if (choice < 1) {
            tri = triArray[0];
        } else if (choice == 2) {
            tri = triArray[1];
        } else {
            tri = triArray[2];
        }
        tri.Push(end+i+1);
        tri.Push(start+i+1);
        tri.Push(start+i);

        tri.Push(end+i);
        tri.Push(end+i+1);
        tri.Push(start+i);
    }

    // Now do the remaining top verts, which are again in proper order
    for(i=0; i<iWidth-1; i++) {
        for(j=0; j<iWidth; j++) {
            choice = Mathf.Floor(Random.value*3);
            if (choice < 1) {
                tri = triArray[0];
            } else if (choice == 2) {
                tri = triArray[1];
            } else {
                tri = triArray[2];
            }
            tri.Push(end+j+(i+1)*(iWidth+1) + 1);
            tri.Push(end+j+(i)*(iWidth+1) + 1);
            tri.Push(end+j+(i)*(iWidth+1));

            tri.Push(end+j+(i+1) * (iWidth+1));
            tri.Push(end+j+(i+1) * (iWidth+1) + 1);
            tri.Push(end+j+(i) * (iWidth+1));
        }
    }

    var triArrayX = new Array();
    for (i=0; i<numMaterials; i++) {
        triArrayX[i] = triArray[i].ToBuiltin(int) as int[];
    }

    // This checks if a submesh exists and adds the corresponding materials array
    var newMats = Array();
    var count = 0;
    for (i=0; i<numMaterials; i++) {
        if (triArrayX[i].length > 0) {
            newMats.push(materials[i]);
            platmesh.SetTriangles(triArrayX[i],count++);
        }
    }
    mr.materials = newMats.ToBuiltin(Material) as Material[];
    platmesh.subMeshCount = count;

    platmesh.RecalculateNormals(); // normal vector calculation

    var lenVerts = iWidth * 4 + 1;
    var lenSquares = 4 * iWidth;
    var topDim = iWidth + 1;

    // UV tiling
    var uv: Vector2[] = new Vector2[platVerts.length];
    var uvIndex = 0;
    for (;uvIndex<(lenVerts)*(iHeight+1); uvIndex++) {
        uv[uvIndex] = Vector2((uvIndex/(lenVerts)) / (1.0*lenSquares), (uvIndex%(lenVerts)) / (1.0*lenSquares));
    }
    var savedUV = uvIndex;

    for (;uvIndex<platVerts.length;uvIndex++) {
        // the dimensions of this one are now iWidth+1 since it's the top, so mod appropriately
        uv[uvIndex] = Vector2((savedUV/lenVerts+(uvIndex-savedUV)/topDim) / (1.0*lenSquares), (uvIndex-savedUV)%topDim / (1.0*lenSquares));
    }
    platmesh.uv = uv;

    mc.sharedMesh = platmesh;
}

// This one takes in an array of prechosen spots
function GeneratePlatforms (platformArray:Vector2[]) {
    for (var w=0;w<platformArray.length;w++) {

        // How I find the max jump height and length, in comment form!

        // Height as f(t) is 10x-7.5x^2, which intercepts at 0 and 4/3 (so halfway is 2/3 as proved above)
        // Plug in .1x for x in the integral equation to get the height as f(x)
        // THUS
        // x-.075x^2 takes in a distance away and gives a max height.
        // if x is less than 6.7 it is the max height (the value at the intercept: 2/3, between roots at 0 and 4/3)

        // This is all calculated from: 
        // Jump initial up velocity as 10
        // gravity as 9.8 (*1.5)
        // and a max horizontal speed as 10

        // what I've learned:
        var max_jump_height = 3.33333;
        var max_jump_length = 13.3333;

        // THIS determines how big my bunches of platforms are. maybe expose this?
        var platform_grid_size = max_jump_length * 2;

        // grid_dim is the amount of vertices of the color map that will be included in my grid
        // This says I want the max dimension of my platform 'area' to be about twice as long as my max jump
        var grid_dim = Mathf.Ceil(platform_grid_size / (step * interp));

        // color_dim is orig_dim: it allows for mapping a color onto vertices
        // This the entire object of the next bit
        var color_dim = Mathf.Sqrt(colormap.length);
        var relevant_i = 0;
        var relevant_j = 0;

        // Comment appropriately for random choice or just the first choice for testing
        var rel_vec: Vector2 = platformArray[w];
        // var rel_vec: Vector2 = relArray[0];
        relevant_i = rel_vec.x;
        relevant_j = rel_vec.y;

        // Matrix is a square array 
        // If cell len is max jump length / 3.0, that means I can safely put towers 2 cells apart
        // and 3 is doable for bonuses
        var cell_len = max_jump_length / 3.0;
        var matrix = constructMatrix(relevant_i,relevant_j,color_dim,grid_dim,cell_len);
        var matrix_len = Mathf.Sqrt(matrix.length);

        // Now I start constructing the thing
        var numColumns = diff_func_dist.length;

        var checkboxes: int[] = new int[matrix_len*matrix_len];
        for (i=0;i<matrix_len*matrix_len;i++) {
            checkboxes[i] = 0;
        }
        var x = (matrix_len - 1) / 2;
        var y = (matrix_len - 1) / 2;
        checkboxes[x*matrix_len+y] = 1;

        var val = getRandomValueWithinCell(matrix,cell_len,matrix_len,x,y);

        var h = max_jump_height - diff_func_height[0];

        addPlatformToMesh(val.x,val.z,h,diff_func_width[0]);
        if (diff_func_reward[0]) {
            AddReward(Vector3(val.x, h+1, val.z));
        }

        var old_x = x;
        var old_y = y;
        var old_h = h;

        for (i=1; i<numColumns; i++) {
            var tester = chooseXY(old_x,old_y,checkboxes,matrix_len,diff_func_dist[i]);
            if (tester == null) {
                // Always have a reward at the end
                if (diff_func_reward[i] != 2) {
                    if (diff_func_reward[i-1] == 0) {
                        AddReward(Vector3(val.x, h+1, val.z));
                    }
                    return;
                } else {
                    Debug.Log("ignored");
                    continue; // you can ignore opt rewards if they don't fit
                }
            }
            var vec: Vector2 = tester;
            x = vec.x;
            y = vec.y;
            checkboxes[x*matrix_len+y] = 1;

            val = getRandomValueWithinCell(matrix,cell_len,matrix_len,x,y);

            h = old_h + getHeightFromDistance(old_x,old_y,val,max_jump_height,matrix,matrix_len) - diff_func_height[i];

            // Old: this just puts rectangles rather than quilt meshes
            // cyl = GameObject.CreatePrimitive(PrimitiveType.Cube);
            // cyl.transform.position = Vector3(val.x,h/2,val.z);
            // cyl.transform.localScale = Vector3(diff_func_width[i],h,diff_func_width[i]);
            addPlatformToMesh(val.x,val.z,h,diff_func_width[i]);

            if (diff_func_reward[i] == 1) {
                AddReward(Vector3(val.x, h+1, val.z));
            } else if (diff_func_reward[i] == 2) {
                AddOptReward(Vector3(val.x, h+1, val.z));
            }

            if (diff_func_reward[i] != 2) {
                old_x = x;
                old_y = y;
                old_h = h;
            }
        }
    }
}

// Basically this function gets new points in the grid an absolute distance away through a recursive function expanding outward from the start
function chooseXY(old_x:int,old_y:int,checkboxes:int[],matrix_len:int,total:int) {
    var vec = Vector2(old_x,old_y);
    var vecArray = new Array();
    chooseHelper(Vector2(vec.x+1,vec.y), vecArray, total-1, checkboxes, matrix_len, 1, 0, false);
    chooseHelper(Vector2(vec.x,vec.y+1), vecArray, total-1, checkboxes, matrix_len, 2, 0, false);
    chooseHelper(Vector2(vec.x-1,vec.y), vecArray, total-1, checkboxes, matrix_len, 3, 0, false);
    chooseHelper(Vector2(vec.x,vec.y-1), vecArray, total-1, checkboxes, matrix_len, 4, 0, false);

    if (vecArray.length == 0) {
        // If you increase to two sometimes the width isn't built to handle that. just use total-1
        // Should total just encompass the full thing? Should be able to handle a max total of max_jump_len/cell_len which is 3 rn
        Debug.Log("YAARRR WE BE EMPTY");
        chooseHelper(Vector2(vec.x+1,vec.y), vecArray, total-1, checkboxes, matrix_len, 1, 0, true);
        chooseHelper(Vector2(vec.x,vec.y+1), vecArray, total-1, checkboxes, matrix_len, 2, 0, true);
        chooseHelper(Vector2(vec.x-1,vec.y), vecArray, total-1, checkboxes, matrix_len, 3, 0, true);
        chooseHelper(Vector2(vec.x,vec.y-1), vecArray, total-1, checkboxes, matrix_len, 4, 0, true);
    }

    if (vecArray.length == 0) {
        // If it is still zero the grid is likely all full
        return null;
    }

    // now pick something at random from our array of results
    return vecArray[Mathf.Floor(Random.value * vecArray.length)];
}

function chooseHelper(vec:Vector2, vecArray:Array, total:int, checkboxes:int[], matrix_len:int, type:int, typeFirst:int, catchall) {
    if (catchall) {
        if (vec.x >= 0 && vec.x < matrix_len && vec.y >= 0 && vec.y < matrix_len && checkboxes[vec.x*matrix_len+vec.y] == 0) {
            vecArray.push(vec);
        }
    }
    if (total == 0) {
        if (vec.x >= 0 && vec.x < matrix_len && vec.y >= 0 && vec.y < matrix_len && checkboxes[vec.x*matrix_len+vec.y] == 0) {
            vecArray.push(vec);
        }
        return;
    }
    if (typeFirst == 0 || typeFirst == type) {
        if (type == 1) {
            chooseHelper(Vector2(vec.x+1,vec.y),vecArray,total-1, checkboxes, matrix_len, 1, type, false);
            chooseHelper(Vector2(vec.x,vec.y+1),vecArray,total-1, checkboxes, matrix_len, 2, type, false);
        } else if (type == 2) {
            chooseHelper(Vector2(vec.x,vec.y+1),vecArray,total-1, checkboxes, matrix_len, 2, type, false);
            chooseHelper(Vector2(vec.x-1,vec.y),vecArray,total-1, checkboxes, matrix_len, 3, type, false);
        } else if (type == 3) {
            chooseHelper(Vector2(vec.x-1,vec.y),vecArray,total-1, checkboxes, matrix_len, 3, type, false);
            chooseHelper(Vector2(vec.x,vec.y-1),vecArray,total-1, checkboxes, matrix_len, 4, type, false);
        } else if (type == 4) {
            chooseHelper(Vector2(vec.x,vec.y-1),vecArray,total-1, checkboxes, matrix_len, 4, type, false);
            chooseHelper(Vector2(vec.x+1,vec.y),vecArray,total-1, checkboxes, matrix_len, 1, type, false);
        } else {
            Debug.Log("NOOOO");
        }
    } else {
        if (type == 1) {
            chooseHelper(Vector2(vec.x+1,vec.y),vecArray,total-1, checkboxes, matrix_len, type, typeFirst, false);
        } else if (type == 2) {
            chooseHelper(Vector2(vec.x,vec.y+1),vecArray,total-1, checkboxes, matrix_len, type, typeFirst, false);
        } else if (type == 3) {
            chooseHelper(Vector2(vec.x-1,vec.y),vecArray,total-1, checkboxes, matrix_len, type, typeFirst, false);
        } else if (type == 4) {
            chooseHelper(Vector2(vec.x,vec.y-1),vecArray,total-1, checkboxes, matrix_len, type, typeFirst, false);
        } else {
            Debug.Log("NOOOO");
        }
    }
}

// This function gets the max height reachable from a given distance away
function getHeightFromDistance(x:int,y:int,val,max_jump,matrix:Vector3[],matrix_len:int) {
    // use x and y to index into the matrix
    var vec = matrix[x*matrix_len+y];
    var d = Vector3.Distance(Vector3(vec.x,1,vec.z), val);
    var h = d - .075*d*d;
    // This uses the 13.33333 value of max jump length
    if (d < 6.7) {
        h = max_jump;
    }
    return h;
}

// Gives the world space points of our platform matrix
function constructMatrix(rel_i:int, rel_j:int, color_dim:int, grid_dim:int, cell_len:float) {
    // These are all the endpoints of our grid
    var a = (rel_i - (color_dim - 1) / 2.0) * step * interp;
    var b = ((rel_i+grid_dim - (color_dim - 1) / 2.0) * step * interp);
    var c = (rel_j - (color_dim - 1) / 2.0) * step * interp;
    var d = ((rel_j+grid_dim - (color_dim - 1) / 2.0) * step * interp);

    // our grid is still square only
    var numCells = Mathf.Floor((b - a) / (cell_len)); // how many cells we can have (approx)

    Debug.Log("numCells in platform matrix: " + numCells);

    var theMatrix: Vector3[] = new Vector3[numCells * numCells];
    // Now we construct the array, which is max jump / 3 apart for numCell times
    for (var i=0; i<numCells; i++) {
        for (var j=0; j<numCells; j++) {
            theMatrix[i*numCells + j] = Vector3(a + cell_len*i,1,c + cell_len*j);
            // Uncommenting just prints the whole array thing, which is fun! as mentioned above
            // var cyl = GameObject.CreatePrimitive(PrimitiveType.Cube);
            // cyl.transform.position = theMatrix[i*numCells + j];
            // cyl.transform.localScale = Vector3(2,2,2);
        }
    }

    return theMatrix;
}

// This applies the random motion from the edge of the grid point
function getRandomValueWithinCell(matrix:Vector3[], cell_len:float, matrix_len:int, i:int, j:int) {
    var vec = matrix[i*matrix_len+j];
    return Vector3(vec.x + Random.value * cell_len, vec.y, vec.z + Random.value * cell_len);
}

/*******************  OVERHANGS *******************/

function GenerateOverhang() {

    // This space searching function is a little different because overhangs use a specific number of verts
    // as opposed to world space: so they don't need to bother with colormap as much as get a certain number of
    // vertices

    // Grid dim refers to our search grid
    var grid_dim = 4; // Right now this code kind of requires 4
    // We just use dim here instead of color dim because we are working with the verts stuff

    var grid_start_x = 0;
    var grid_start_z = 0;
    var grid_dim_x = grid_dim;
    var grid_dim_z = grid_dim;

    var overhangHeightVariance = Random.value * 2 - 1;

    var dir:int = Mathf.Floor(Random.value * 4);
    // 0 is a,c => +z
    // 1 is a,d => +x
    // 2 is b,c => -x
    // 3 is b,d => -z
    if (dir == 0) {
        grid_dim_z += overHangLen;
    } else if (dir == 1) {
        grid_dim_x += overHangLen;
    } else if (dir == 2) {
        grid_start_x -= overHangLen;
    } else if (dir == 3) {
        grid_start_z -= overHangLen;
    } else {
        Debug.Log("THIS IS WRHONG");
    }

    // This the entire object of the next bit
    // we search less vertices overall since we are using a square window: don't want to go over edges!
    var search_dim_x = dim - (grid_dim_x - grid_start_x) - interp;
    var search_dim_z = dim - (grid_dim_z - grid_start_z) - interp;
    // This is for colormap values
    var color_dim = Mathf.Sqrt(colormap.length);
    var relArray = new Array();
    var rel_i = 0;
    var rel_j = 0;
    var allsgood = false;
    for (var i=interp; i< search_dim_x; i++) {
        for (var j=interp; j< search_dim_z; j++) {
            if (vertices[i*dim + j].y < 1 && vertices[i*dim + j].y > -1) {
                // we have hit a grass point! check that the rest of the square is grass
                allsgood = true;
                for (var ii = i; ii < i+(grid_dim_x-grid_start_x); ii++) {
                    for (var jj = j; jj < j+(grid_dim_z-grid_start_z); jj++) {
                        if (vertices[ii*dim + jj].y <= -1 || vertices[ii*dim + jj].y >= 1 || colormap[(ii/interp)*color_dim + (jj/interp)] != 2) {
                            allsgood = false;
                        }
                    }
                }
                if (allsgood) {
                    relArray.push(Vector2(i-grid_start_x,j-grid_start_z));
                }
            }
        }
    }

    if (relArray.length == 0) {
        Debug.Log("No overhangs could be placed");
        return null;
    }

    // Comment appropriately for random choice or just the first choice for testing
    var rel_vec: Vector2 = relArray[Mathf.Floor(Random.value*relArray.length)];
    // var rel_vec: Vector2 = relArray[0];
    rel_i = rel_vec.x;
    rel_j = rel_vec.y;

    // Mapped!
    for (i=rel_i+grid_start_x; i < rel_i+grid_dim_x; i++) {
        for (j=rel_j+grid_start_z; j < rel_j+grid_dim_z; j++) {
            colormap[(i/interp)*color_dim + (j/interp)] = 4; // 4 is overhang
        }
    }

    
    // Choosing the overhang direction randomly
    // Rotating all the points using quaternions is a more general case of this
    // But I hadn't learned that in graphics yet *shrugs*

    var a: Vector3;
    var b: Vector3;
    var c: Vector3;
    var d: Vector3;

    // 0 is a,c => +z
    // 1 is a,d => +x
    // 2 is b,c => -x
    // 3 is b,d => -z
    if (dir / 2 == 1) {
        a = Vector3(0,5 + overhangHeightVariance,0);
        b = Vector3(0,7 + overhangHeightVariance,0);
    } else {
        b = Vector3(0,5 + overhangHeightVariance,0);
        a = Vector3(0,7 + overhangHeightVariance,0);
    }
    if (dir % 2 == 1) {
        c = Vector3(0,5 + overhangHeightVariance,0);
        d = Vector3(0,7 + overhangHeightVariance,0);
    } else {
        d = Vector3(0,5 + overhangHeightVariance,0);
        c = Vector3(0,7 + overhangHeightVariance,0);
    }

    vertices[(rel_i+1)*dim+(rel_j+1)] += a;
    vertices[(rel_i+2)*dim+(rel_j+2)] += b;

    vertices[(rel_i+2)*dim+(rel_j+1)] += c;
    vertices[(rel_i+1)*dim+(rel_j+2)] += d;

    // Note: If I call this after midpoint generation I get fun little holes to jump into
    // calling before creates overhangs as expected
    return Vector3(rel_i,rel_j, dir);
}

/******** TERRAIN GENERATION: THE TRUE BEAST ***********/

function GenerateTerrain () {

    colormap = this.GetColormap();

 	// loop variables
 	var i = 0;
    var j = 0;
    var k = 0;
    var temp = 0;

    // We save these for things like height map construction, which ignores interp
    var orig_dim = dim;
    var orig_num = dim*dim;

    // Interp affects the actual values of some inputs
    step /= (1.0 * interp);
    dim = (dim - 1) * interp + 1;
    // Step and dim always represent the actual number of vertices

    var num = dim * dim;
    var inner_dim = dim-1;
    var inner_num = (dim-1) * (dim-1);
    var origin: float = (dim-1) / 2.0;

    var mf: MeshFilter = GetComponent.<MeshFilter>();
    mcoll = GetComponent.<MeshCollider>();
    var mr: MeshRenderer = GetComponent.<MeshRenderer>();
    mesh = new Mesh();
    mf.mesh = mesh;


    /******* HEIGHT MAP ********/


    // initially populate the height map with just the random (well, based on coloring) points. then interp!
    var orig_hmap: float[] = new float[orig_num];
    for (i=0; i<orig_num; i++) {
        var top: float;
        var bottom: float;
        if (colormap[i] == 1) { // mountains
            top = max;
            bottom = ground;
        } else if (colormap[i] == 2 || colormap[i] == 0) { // grass: 5% leeway in either direction
            top = ground + (max-ground)/20.0;
            bottom = ground - (max-ground)/20.0;
        } else if (colormap[i] == 3) { // lakes
            top = ground-(max-ground)/4.0;
            bottom = ground - (max-ground)/1.5;
            // Lake wavey stuff
            // top = -1;
            // bottom = -1;
        } else {
            Debug.Log("uhoh");
        }
        orig_hmap[i] = bottom + Random.value * (top-bottom);
    }

    // now we interpolate, start with horizontal (based on interp)
    var temp_hmap: float[] = new float[orig_dim * dim];
    for (i=0; i<orig_dim; i++) {
        for (j=0; j<dim-1; j++) {
            temp_hmap[i * dim + j] = (interp-j%interp)/(1.0*interp) * orig_hmap[i*orig_dim + j/interp] + 
                                     (j%interp)/(1.0*interp)        * orig_hmap[i*orig_dim + j/interp + 1];
        }
        // Fencepost to deal with out of bounds errors
        temp_hmap[i * dim + (dim-1)] = orig_hmap[i*orig_dim + (dim-1)/interp];
    }

    // vertical, thus making everything fully interpolated
    var hmap: float[] = new float[num];
    for (i=0; i<dim; i++) {
        for (j=0; j<dim-1; j++) {
            hmap[i + j * dim] = (interp-j%interp)/(1.0*interp) * temp_hmap[i + (j/interp) * dim] + 
                                (j%interp)/(1.0*interp)        * temp_hmap[i + (1 + j/interp) * dim];
        }
        // Fencepost Round Two
        hmap[i + (dim-1) * dim] = temp_hmap[i + ((dim-1)/interp) * dim];
    }


    /******* VERTICES ********/

    vertices = new Vector3[num+inner_num];
    verticesInfo = new boolean[num+inner_num];
    for (i=0; i<num; i++) {
    	vertices[i] = new Vector3(step * (i / dim) - (step * origin), hmap[i], step * (i % dim) - (step * origin));
        verticesInfo[i] = false;
        // lake wavey thing
        // if (hmap[i] == -1) {
        //     verticesInfo[i] = true;
        //     lakeWaveys.Push(i);
        // }
    }

    var platformArray = this.PrepPlatforms(numPlatforms);

    var oHangs: Vector3[] = new Vector3[numOverhangs];
    for (i=0; i<numOverhangs; i++) {
        var tempOHang = this.GenerateOverhang();
        // Debug.Log(tempOHang);
        if (tempOHang == null) {
            numOverhangs = i;
            break;
        }
        oHangs[i] = tempOHang;
    }

    var tempWaveDim;
    var stupid;

    for (i=0; i<numWaveys; i++) {
        // 5 gives 4 squares in middle to work with (16 total)
        tempWaveDim = waveySize + Mathf.Floor(Random.value*3) - 1;
        stupid = this.ReserveWaveSpace(tempWaveDim);
        if (stupid != null) {
            waveDim[i] = tempWaveDim;
            waveStartI[i] = stupid.x;
            waveStartJ[i] = stupid.y;
            wavePlat[i] = false;
        } else {
            numWaveys = i;
            break;
        }
    }

    for (i=numWaveys; i < numWaveys+numPlatWaveys; i++) {
        // same calc as in platformGen
        tempWaveDim = Mathf.Ceil(13.3333 * 4/3.0);
        stupid = this.ReserveWaveSpace(tempWaveDim);
        if (stupid != null) {
            waveDim[i] = tempWaveDim;
            waveStartI[i] = stupid.x;
            waveStartJ[i] = stupid.y;
            wavePlat[i] = true;
        } else {
            numPlatWaveys = i-numWaveys;
            break;
        }
    }
    this.InitWaveys();
    // Lake wavey stuff
    // this.InitLakeWaveys();

    // make the inner height map verts: average of the 4 'square point' neighbors
    for(i=0; i<inner_dim; i++) {
        temp = i * dim;
    	for(j=0; j<inner_dim; j++) {
    		var avg = vertices[temp+j].y + vertices[temp+j+1].y + vertices[temp+j+dim].y + vertices[temp+j+dim+1].y;
            // var avg = hmap[temp+j] + hmap[temp+j+1] + hmap[temp+j+dim] + hmap[temp+j+dim+1];
            // Note: Could get the color for all these verts as average of the neighbor colors to determine color type
    		avg = avg / 4.0;
    		vertices[num + i*inner_dim + j] = new Vector3((step / 2.0) + (i * step) - (step*origin), avg, (step / 2.0) + (j * step) - (step*origin));
            // VerticesInfo
            // W/ '||' works for lakes, w/ '&&' works for other stuff
            if (verticesInfo[temp+j] && verticesInfo[temp+j+1] && verticesInfo[temp+j+dim] && verticesInfo[temp+j+dim+1]) {
            // if (verticesInfo[temp+j] || verticesInfo[temp+j+1] || verticesInfo[temp+j+dim] || verticesInfo[temp+j+dim+1]) {
                verticesInfo[num + i*inner_dim + j] = true;
            } else {
                verticesInfo[num + i*inner_dim + j] = false;
            }
    	}
    }


    var overHangLenVariance = Random.value * 2 - 1;
    var overHangAngleVariance = Random.value * 2 -1;
    // 0 is a,c => +z
    // 1 is a,d => +x
    // 2 is b,c => -x
    // 3 is b,d => -z
    // This is also part of overhang generation: this is where I do the 
    for (i=0; i<numOverhangs; i++) {
        if (oHangs[i] == null) {
            break; // no more!
        }

        if (oHangs[i].z == 0) {
            vertices[num+(oHangs[i].x+1)*inner_dim + (oHangs[i].y+1)] += Vector3(0,overHangAngleVariance + 1,overHangLen + overHangLenVariance);
            AddReward(vertices[num+(oHangs[i].x+1)*inner_dim + (oHangs[i].y+1)] + Vector3(0,1,-1*hangRewardDiff));
        } else if (oHangs[i].z == 1) {
            vertices[num+(oHangs[i].x+1)*inner_dim + (oHangs[i].y+1)] += Vector3(overHangLen + overHangLenVariance,overHangAngleVariance + 1,0);
            AddReward(vertices[num+(oHangs[i].x+1)*inner_dim + (oHangs[i].y+1)] + Vector3(-1*hangRewardDiff,1,0));
        } else if (oHangs[i].z == 2) {
            vertices[num+(oHangs[i].x+1)*inner_dim + (oHangs[i].y+1)] += Vector3(-1*overHangLen + overHangLenVariance,overHangAngleVariance + 1,0);
            AddReward(vertices[num+(oHangs[i].x+1)*inner_dim + (oHangs[i].y+1)] + Vector3(hangRewardDiff,1,0));
        } else if (oHangs[i].z == 3) {
            vertices[num+(oHangs[i].x+1)*inner_dim + (oHangs[i].y+1)] += Vector3(0,overHangAngleVariance + 1,-1*overHangLen + overHangLenVariance);
            AddReward(vertices[num+(oHangs[i].x+1)*inner_dim + (oHangs[i].y+1)] + Vector3(0,1,hangRewardDiff));
        } else {
            Debug.Log("WHDISHCSC");
        }
    }

    mesh.vertices = vertices;


    /******* TRIANGLES ********/

    var numMaterials = 10;

    // Create enough arrays to hold each set of triangles in a submesh (for diff colors)
    var triArray: Array[] = new Array[numMaterials];
    for (i=0; i<numMaterials; i++) {
        triArray[i] = new Array();
    }

    var tri = new Array();

    groundMat.color = groundColor;
    mountainMat.color = mountainColor;
    lakeMat.color = lakeColor;

    // WaveMat: lava! just uses mountain color for now
    var waveMat = Material(plainMat);
    waveMat.color = mountainColor;
    waveMat.mainTextureScale = Vector2((dim-1),(dim-1));

    // Change materials to all tile properly
    groundMat.mainTextureScale = Vector2((dim-1),(dim-1));
    mountainMat.mainTextureScale = Vector2((dim-1),(dim-1));
    lakeMat.mainTextureScale = Vector2((dim-1),(dim-1));

    var gc = groundMat.color;
    var groundMatLight = new Material(groundMat);
    groundMatLight.color = Color(gc.r + ((1 - matFac) * (1 - gc.r)), 
                                 gc.g + ((1 - matFac) * (1 - gc.g)), 
                                 gc.b + ((1 - matFac) * (1 - gc.b)), 1);
    var groundMatDark = new Material(groundMat);
    groundMatDark.color = Color(gc.r * matFac, gc.g * matFac, gc.b * matFac, 1);

    var mc = mountainMat.color;
    var mountainMatLight = new Material(mountainMat);
    mountainMatLight.color = Color(mc.r + ((1 - matFac) * (1 - mc.r)), 
                                 mc.g + ((1 - matFac) * (1 - mc.g)), 
                                 mc.b + ((1 - matFac) * (1 - mc.b)), 1);
    var mountainMatDark = new Material(mountainMat);
    mountainMatDark.color = Color(mc.r * matFac, mc.g * matFac, mc.b * matFac, 1);

    var lc = lakeMat.color;
    var lakeMatLight = new Material(lakeMat);
    lakeMatLight.color = Color(lc.r + ((1 - matFac) * (1 - lc.r)), 
                                 lc.g + ((1 - matFac) * (1 - lc.g)), 
                                 lc.b + ((1 - matFac) * (1 - lc.b)), 1);
    var lakeMatDark = new Material(lakeMat);
    lakeMatDark.color = Color(lc.r * matFac, lc.g * matFac, lc.b * matFac, 1);

    // add elements to the materials array
    var materials: Material[] = new Material[numMaterials];
    materials[0] = groundMat;
    materials[1] = groundMatLight;
    materials[2] = groundMatDark;
    materials[3] = mountainMat;
    materials[4] = mountainMatLight;
    materials[5] = mountainMatDark;
    materials[6] = lakeMat;
    materials[7] = lakeMatLight;
    materials[8] = lakeMatDark;
    materials[9] = waveMat;

    mesh.subMeshCount = numMaterials;

    var groundVariance = (max-ground)/20.0;

    for(i=0; i<inner_dim; i++) {
        temp = i * dim;
    	for(j=0; j<inner_dim; j++) {
            var middleVert = num + i * inner_dim + j;
            var choice: int = Mathf.Floor(Random.value * 4);
            if (verticesInfo[middleVert]) {
                tri = triArray[9];
            } else if (vertices[middleVert].y > ground + groundVariance) {
                if (choice < 2) {
                    tri = triArray[3];
                } else if (choice == 2) {
                    tri = triArray[4];
                } else {
                    tri = triArray[5];
                }
            } else if (vertices[middleVert].y < ground - groundVariance) {
                if (choice < 2) {
                    tri = triArray[6];
                } else if (choice == 2) {
                    tri = triArray[7];
                } else {
                    tri = triArray[8];
                }
            } else {
                if (choice < 2) {
                    tri = triArray[0];
                } else if (choice == 2) {
                    tri = triArray[1];
                } else {
                    tri = triArray[2];
                }
            }

            tri.Push(temp + j);
            tri.Push(temp + j + 1);
            tri.Push(middleVert);

            tri.Push(temp + j + 1);
            tri.Push(temp + j + dim + 1);
            tri.Push(middleVert);

            tri.Push(temp + j + dim + 1);
            tri.Push(temp + j + dim);
            tri.Push(middleVert);

            tri.Push(temp + j + dim);
            tri.Push(temp + j);
            tri.Push(middleVert);
    	}
    }

    var triArrayX = new Array();
    for (i=0; i<numMaterials; i++) {
        triArrayX[i] = triArray[i].ToBuiltin(int) as int[];
    }

    // This checks if a submesh exists and adds the corresponding materials array
    var newMats = Array();
    var count = 0;
    for (i=0; i<numMaterials; i++) {
        if (triArrayX[i].length > 0) {
            newMats.push(materials[i]);
            mesh.SetTriangles(triArrayX[i],count++);
        }
    }
    mr.materials = newMats.ToBuiltin(Material) as Material[];
    mesh.subMeshCount = count;

    mesh.RecalculateNormals(); // normal vector calculation

    // UV tiling
    var uv: Vector2[] = new Vector2[vertices.length];
    for (i=0; i<num; i++) {
        uv[i] = Vector2((i/dim) / (1.0*(dim-1)), (i%dim) / (1.0*(dim-1)));
    }
    for (i=0; i<inner_num; i++) {
        uv[i+num] = Vector2((1/(2.0*(dim-1)))+(i/inner_dim) / (1.0*(dim-1)), (1/(2.0*(dim-1)))+ (i%inner_dim) / (1.0*(dim-1)));
    }
    mesh.uv = uv;

    mcoll.sharedMesh = mesh;

    this.LetsStartAHunt();

    if (platformArray != null) {
        this.GeneratePlatforms(platformArray);
    }
}

/* COLORMAP FUNCTIONS -- USED BY GENERATE TERRAIN */

function GetColormap () {
    var colors: Color[];
    var height: int;
    var width: int;

    colors = text.GetPixels(0,0,256,256,0);
    height = 256;
    width = 256;

    userDraw = false;
    
    var i=0;
    var j=0;
    var colorlen = dim; // number of verts: this is before dim is changed for terrain generation
    var colornum = colorlen * colorlen;

    var colormapr: float[] = new float[colornum];
    var colormapg: float[] = new float[colornum];
    var colormapb: float[] = new float[colornum];

    // Adding colorlen-1 makes division a ceiling operation instead of floor
    var verticalScale: int = (height + (colorlen-1)) / colorlen;
    var horizontalScale: int = (width + (colorlen-1)) / colorlen;

    // This maps things to our colormap with appropriate scaling somehow (math is hard)
    for (i=0;i<height;i++) {
        for(j=0;j<width;j++) {
            colormapr[(i/verticalScale)*colorlen+(j/horizontalScale)] += colors[(height-i-1)*width+j].r;
            colormapg[(i/verticalScale)*colorlen+(j/horizontalScale)] += colors[(height-i-1)*width+j].g;
            colormapb[(i/verticalScale)*colorlen+(j/horizontalScale)] += colors[(height-i-1)*width+j].b;
        }
    }

    var colormap: int[] = new int[colornum];
    for (i=0;i<colornum;i++) {
        var val = Mathf.Max(colormapr[i],colormapg[i],colormapb[i]);
        if (colormapr[i] == val) 
            colormap[i] = 1; // red
        if (colormapb[i] == val)
            colormap[i] = 3; // blue
        if (colormapg[i] == val)
            colormap[i] = 2; // green
        if (colormapr[i]+colormapb[i]+colormapg[i] == 0) {
            colormap[i] = 0; // black
        }
        if (this.IsOnEdge(i,colorlen,colornum)) {
            colormap[i] = 0;
        }
    }

    return colormap;
}

// Helper to figure out if a point is on the edge of the colormap
function IsOnEdge (index:int, length:int, len_sq:int) {
    if (index >= 0 && index < length)
        return true;
    if (index % length == 0)
        return true;
    if ((index+1) % length == 0)
        return true;
    if (index >= (len_sq-length) && index < len_sq)
        return true;
    return false;
}

/*******************  START AND UPDATE  *******************/

// Initial Tasks
function Start () {

    // Find the player inside the container, and deactivate them until we are ready
    for (var p: Transform in player.transform) {
        if (p.gameObject.activeSelf) {
            player = p.gameObject;
            break;
        }
    }
    player.SetActive(false);

    // Choose a difficulty mode
    this.AssignDifficulty(difficultyMode);

    // Construct other materials
    groundMat = new Material(quiltMat);
    mountainMat = new Material(quiltMat);
    lakeMat = new Material(quiltMat);

    // Init the wavey arrays
    waveDim = new int[numWaveys+numPlatWaveys];
    waveStartI = new int[numWaveys+numPlatWaveys];
    waveStartJ = new int[numWaveys+numPlatWaveys];
    waveInit = new Array[numWaveys+numPlatWaveys];
    wavePlat = new boolean[numWaveys+numPlatWaveys];

    text = new Texture2D(256,256,TextureFormat.ARGB32,false);
    // This is the default texture: if user is drawing this gets reset to be all green
    for(var i=0;i<256;i++) {
        for(var j=0;j<256;j++) {
            // TODO: this should instead ensure the middle 4 verts are grass and blocked off
            if (i < 150 && i > 106 && j > 106 && j < 150) {
                text.SetPixel(i,j,Color.black);
            } else if (i < 50 && !userDraw) {
                text.SetPixel(i,j,Color.blue);
            } else if (i > 200 && !userDraw) {
                text.SetPixel(i,j,Color.red);
            } else {
                text.SetPixel(i,j,Color.green); // do Color(0,0.8,0,1) for dark green (shows erasing)
            }
        }
    }
    text.Apply(false);

    if (userDraw) {
        var rend = image.GetComponent(UI.RawImage);
        rend.texture = text;
    } else {
        Destroy(image);
        this.StartFunctions();
    }
}

// Generates the world and enables control, either from drawing or default
function StartFunctions() {
    // Setup Audio
    var sources = GetComponents(AudioSource);
    if (playAudio) {
        sources[1].Play(); // super mario galaxy theme
    }
    fanfare = sources[0]; // the trumpets

    // Generate Terrain
    GenerateTerrain();
    GenerateRocks(numRocks);
    GenerateDeath();
    AddReward(Vector3(-1*(step*interp)/4.0,1,0)); // one reward at start teaches player about rewards

    wegood = true; // We can start updating lava mesh geometry

    // Set up Player
    player.SetActive(true);
    var rb = player.GetComponent.<Rigidbody>();
    rb.velocity = Vector3(0,2,0);
    var transform = player.transform.position;
    transform = Vector3((step*interp)/4.0,5,0); // Mirrors the reward across z axis (forward)
    player.transform.position = transform;
}

// This handles both the drawing app portion and updating the waveys and score after that
function Update () {
    if (userDraw) {
        // Color changes
        if (Input.GetKeyDown("g")) { 
            color = Color.green;
            instructions.GetComponent.<UnityEngine.UI.Text>().text = 
"Click and drag on the square to draw!\n\n\nPress 'r' to draw mountain ranges\n\n*** Press 'g' for grass (erase)\n\nPress 'b' for gorges\n\n\nPress 'p' to start playing!"
            ;
        } 
        if (Input.GetKeyDown("b")) { 
            color = Color.blue; 
            instructions.GetComponent.<UnityEngine.UI.Text>().text = 
"Click and drag on the square to draw!\n\n\nPress 'r' to draw mountain ranges\n\nPress 'g' for grass (erase)\n\n*** Press 'b' for gorges\n\n\nPress 'p' to start playing!"
            ;
        }
        if (Input.GetKeyDown("r")) { 
            color = Color.red; 
            instructions.GetComponent.<UnityEngine.UI.Text>().text = 
"Click and drag on the square to draw!\n\n\n*** Press 'r' to draw mountain ranges\n\nPress 'g' for grass (erase)\n\nPress 'b' for gorges\n\n\nPress 'p' to start playing!"
            ;
        }

        // Click handling: draw whatever color is selected!
        if (Input.GetMouseButton(0)) {
            var mX = Input.mousePosition.x;
            var mY = Input.mousePosition.y;

            var mXInit = Screen.width  / 2 - 128;
            var mXEnd =  Screen.width  / 2 + 128;
            var mYInit = Screen.height / 2 - 128;
            var mYEnd =  Screen.height / 2 + 128;
            
            if (mX >= mXInit && mX < mXEnd &&
                mY >= mYInit && mY < mYEnd) {
                // We are in the square!
                mX = Mathf.Floor(mX - mXInit);
                mY = Mathf.Floor(mY - mYInit);
                var cols: Color[] = text.GetPixels(0);
                // This draws based on brush size: a square area around your mouse location
                for (var i=-brush;i<=brush;i++) {
                    for(var j=-brush;j<=brush;j++) {
                        if (mX+i < 0 || mX+i > 255 || mY+j < 0 || mY+j > 255) {
                            continue; // off an edge
                        }
                        if (mX+i < 150 && mX+i > 106 && mY+j > 106 && mY+j < 150) {
                            continue; // in the middle
                        }
                        // 256 is the side length of the canvas
                        cols[(mY+j)*256+(mX+i)] = color;
                    }
                }
                text.SetPixels(cols, 0);
                text.Apply(false);
            }
        }

        // Time to create everything!
        if (Input.GetKeyDown("p")) {
            this.StartFunctions();
            Destroy(image);
            Destroy(instructions);
        }
    } else {
        if (wegood) {
            this.UpdateWaveys();
            // this.UpdateLakeWaveys();
            mesh.vertices = vertices;
            mesh.RecalculateNormals();
        }
        if (showTime) {
            if (notplayed) {
                timeElapsed += Time.deltaTime;
            }
            canvas.transform.Find("Time").GetComponent.<UnityEngine.UI.Text>().text = "Time: " + Mathf.Floor(timeElapsed);
        }
        canvas.transform.Find("Text").GetComponent.<UnityEngine.UI.Text>().text = "Circlez: " + player.GetComponent.<RewardUpdate>().score + "/" + rewardCount;
        if (player.GetComponent.<RewardUpdate>().score == rewardCount && notplayed) {
            fanfare.Play();
            notplayed = false;
        }
    }
}




/******** UTILITIES **********/



function AddReward(vec:Vector3) {
    Instantiate(reward, vec, Quaternion.identity);
    rewardCount++;
}

function AddOptReward(vec:Vector3) {
    Instantiate(reward2, vec, Quaternion.identity);
    // You could make this more or less: right now it is same as other rewards, but it plays higher sound!
    rewardCount++; 
}

function DecrementRewardCount() {
    rewardCount--;
}

function GenerateDeath() {
    // Add a death zone to each side of the map stretching to infinity
    var death: GameObject;

    // Sides of map are (dim-1)/2*step in world coords
    // Changing the box collider center changes how it scales (in this case we want outward)
    death = Instantiate(deathCollider,Vector3((dim-1)/2*step,-.5,0),Quaternion.identity);
    death.GetComponent.<BoxCollider>().center = Vector3(0.5,0,0);
    death.transform.localScale = Vector3(1000,1,1000);

    death = Instantiate(deathCollider,Vector3(0,-.5,(dim-1)/2*step),Quaternion.identity);
    death.GetComponent.<BoxCollider>().center = Vector3(0,0,0.5);
    death.transform.localScale = Vector3(1000,1,1000);

    death = Instantiate(deathCollider,Vector3(-(dim-1)/2*step,-.5,0),Quaternion.identity);
    death.GetComponent.<BoxCollider>().center = Vector3(0.5,0,0);
    death.transform.localScale = Vector3(-1000,1,1000);

    death = Instantiate(deathCollider,Vector3(0,-.5,-(dim-1)/2*step),Quaternion.identity);
    death.GetComponent.<BoxCollider>().center = Vector3(0,0,0.5);
    death.transform.localScale = Vector3(1000,1,-1000);
}

// Picks the difficulty function
function AssignDifficulty(diff:int) {

    if (diff==0) {
        // Hard
        diff_func_height = [.3,.3,.3,.5,.5,.3,.2,.2,.2];
        // Notes: greater is easier
        diff_func_width  = [4.0,3.5,3.0,2.5,2.0,1.5,0.5,1.0,1.5];
        // Notes: .5 is likely too thin except for optional
        diff_func_dist   = [0,1,1,1,2,2,3,1,1];
        // Notes: ending with 1s are more likely to be axed from the procedure 
        //        first value is ignored
        diff_func_reward = [1,0,0,1,0,1,2,0,1];
        // Notes: the final pillar will always have a reward if the last element in this array does even if there aren't 8 pillars
    } else if (diff == 1) {
        // Simple
        diff_func_height = [.5,.5,.5,.5,.5,.5];
        diff_func_width  = [4.0,4.0,4.0,4.0,1.0,4.0];
        diff_func_dist   = [0,1,1,1,2,1];
        diff_func_reward = [1,0,1,0,2,1];
    } else if (diff == 2 ){
        // Medium
        diff_func_height = [1.0,0.5,1.0,0.5,1.0,0.5,0.5,1.0,0.5];
        diff_func_width  = [4,4,3,3,2,2,1,2,2.0];
        diff_func_dist   = [0,1,1,1,2,2,3,1,1];
        diff_func_reward = [1,0,0,1,0,1,2,0,1];
    } else if (diff == 3){
        // Hard with a two jump earlier
        // diff_func_height = [0.3, 0.7, 0.3, 0.5, 0.5, 0.3, 0.2, 0.2, 0.2];
        diff_func_height = [0.3, 0.7, 0.3, 0.5, 0.5, 0.3, 0.2, 0.5, 0.5];
        diff_func_width  = [4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 0.5, 1.0, 1.5];
        diff_func_dist   = [  0,   1,   2,   1,   2,   2,   3,   1,   1];
        diff_func_reward = [  1,   0,   0,   1,   0,   1,   2,   0,   1];
    } else {
        Debug.Log("uhoh");
    }
}