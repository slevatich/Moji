#pragma strict

import UnityStandardAssets.CrossPlatformInput;

/* This and TPChar are based on ThirdPersonUser and ThirdPersonCharacter scripts in standard assets,
   But modified to work with my additional mechanics and alterations */

private var m_Character: TPChar; 	// A reference to the ThirdPersonCharacter on the object
private var m_Cam: Transform; 		// A reference to the main camera in the scenes transform
private var m_CamForward: Vector3; 	// The current forward direction of the camera
private var m_Move: Vector3;		// the world-relative desired move direction, calculated from the camForward and user input.

// My Additions
private var m_Jump: boolean;
private var m_Jump_Release: boolean; // This tells the character thing that you have released the jump button
private var m_Grapple: boolean;
// Emotions
private var m_Confuse: boolean;
private var m_Glare: boolean;
private var m_Sad: boolean;
private var m_Happy: boolean;
private var m_Fight: boolean;
private var m_Shock: boolean;
private var m_Jig: boolean;
private var m_HairWhip: boolean;
private var m_Flail: boolean;

private var m_FlailOff: boolean;
private var m_JigOff: boolean;

private var selfie: boolean;
private var enableJumpRelease: boolean = true;

function Start () {
	// get the transform of the main camera (tagged w/ maincamera)
    m_Cam = Camera.main.transform;
    // get the third person character script
    m_Character = GetComponent.<TPChar>();
}

// Input
function Update () {
	if (!m_Jump) {
        m_Jump = CrossPlatformInputManager.GetButtonDown("Jump");
    }
    if (enableJumpRelease && !m_Jump_Release) {
        m_Jump_Release = CrossPlatformInputManager.GetButtonUp("Jump");
    }
    if (!m_Grapple) {
        m_Grapple = CrossPlatformInputManager.GetButtonDown("Grapple");
    }
    var maskOn  = CrossPlatformInputManager.GetButtonDown("Selfie");
    var maskOff = CrossPlatformInputManager.GetButtonUp("Selfie");
    if (maskOn) selfie = true;
    if (maskOff) selfie = false;

    if (!m_Confuse) m_Confuse = CrossPlatformInputManager.GetButtonDown("Confuse");
    if (!m_Sad)     m_Sad     = CrossPlatformInputManager.GetButtonDown("Sad");
    if (!m_Shock)   m_Shock   = CrossPlatformInputManager.GetButtonDown("Shock");
    if (!m_Fight)   m_Fight   = CrossPlatformInputManager.GetButtonDown("Fight");
    if (!m_Happy)   m_Happy   = CrossPlatformInputManager.GetButtonDown("Happy");
    if (!m_Glare)   m_Glare   = CrossPlatformInputManager.GetButtonDown("Glare");
    if (!m_Jig)     m_Jig     = CrossPlatformInputManager.GetButtonDown("Jig");
    if (!m_HairWhip)m_HairWhip= CrossPlatformInputManager.GetButtonDown("HairWhip");
    if (!m_Flail)   m_Flail   = CrossPlatformInputManager.GetButtonDown("Flail");

    if (!m_FlailOff) m_FlailOff = CrossPlatformInputManager.GetButtonUp("Flail");
    if (!m_JigOff)   m_JigOff   = CrossPlatformInputManager.GetButtonUp("Jig");

}

// Movement
function FixedUpdate () {
    // read camera inputs
    var h: float = CrossPlatformInputManager.GetAxis("Horizontal");
    var v: float = CrossPlatformInputManager.GetAxis("Vertical");

    // calculate camera relative direction to move:
    m_CamForward = Vector3.Scale(m_Cam.forward, Vector3(1, 0, 1)).normalized;
    m_Move = v*m_CamForward + h*m_Cam.right;

    // Ignore movement and jumping in selfie mode
    if (selfie) {
        m_Move = Vector3(0,0,0);
        m_Jump = false;
        m_Jump_Release = false;
        m_Grapple = false;
    }

    // pass all parameters to the character control script
    m_Character.Move(m_Move, m_Jump, m_Jump_Release, m_Grapple, [m_Confuse,m_Glare,m_Sad,m_Happy,m_Fight,m_Shock,m_Jig,m_HairWhip,m_Flail,m_FlailOff,m_JigOff]);

    // Falsified s.t. we check for them on update loops
    m_Jump = false;
    m_Jump_Release = false;
    m_Grapple = false;
    // Emotions
    m_Confuse = false;
    m_Glare = false;
    m_Sad = false;
    m_Happy = false;
    m_Fight = false;
    m_Shock = false;
    m_Jig = false;
    m_HairWhip = false;
    m_Flail = false;
    m_FlailOff = false;
    m_JigOff = false;
}
