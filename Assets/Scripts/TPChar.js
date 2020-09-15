#pragma strict

/* This and TPUSer are based on ThirdPersonUser and ThirdPersonCharacter scripts in standard assets,
   But modified to work with my additional mechanics and alterations */

var m_MovingTurnSpeed: float = 720;
var m_StationaryTurnSpeed: float = 720;
var m_JumpPower: float = 10f;
var m_GravityMultiplier: float = 1.5;
var m_RunCycleLegOffset: float = 0.2; //specific to the character in sample assets, will need to be modified to work with others
var m_MoveSpeedMultiplier: float = 1; // 2.8
var m_AnimSpeedMultiplier: float = 1; // 1.6
var m_GroundCheckDistance: float = 0.3;

var delayVal: int = 15;
var collisionSphereVal: float = 0.8;

private var k_Half: float = 0.5; // This is const

// Variables
private var m_Rigidbody: Rigidbody;
private var m_Animator: Animator;
private var m_IsGrounded: boolean;
private var m_OrigGroundCheckDistance: float;
private var m_TurnAmount: float;
private var m_ForwardAmount: float;
private var m_GroundNormal: Vector3;
private var m_CapsuleHeight: float;
private var m_CapsuleCenter: Vector3;
private var m_Capsule: CapsuleCollider;
private var m_Crouching: boolean;

// My Additions
private var last_Grounded: boolean = true;
private var delay: int = 0;
private var inJump: boolean = false;
private var m_Grapple: boolean = false;
// Emotions
private var m_Confuse: boolean = false;
private var m_Glare: boolean = false;
private var m_Sad: boolean = false;
private var m_Happy: boolean = false;
private var m_Fight: boolean = false;
private var m_Shock: boolean = false;
private var m_Jig: boolean = false;
private var m_HairWhip: boolean = false;
private var m_Flail: boolean = false;
private var m_FlailOff: boolean = false;
private var m_JigOff: boolean = false;

private var bounce: boolean = false;

private var queuedGrapple: boolean = false;
private var grappleResult: Vector3 = Vector3(0,0,0);

private var hairDirection: Vector3 = Vector3(0,0,0);

function Awake () {
	// Get all the things I need
	m_Animator = GetComponent.<Animator>();
	m_Rigidbody = GetComponent.<Rigidbody>();
	m_Capsule = GetComponent.<CapsuleCollider>();
	m_CapsuleHeight = m_Capsule.height;
	m_CapsuleCenter = m_Capsule.center;

	m_Animator.applyRootMotion = false;
	m_Rigidbody.constraints = RigidbodyConstraints.FreezeRotationX | RigidbodyConstraints.FreezeRotationY | RigidbodyConstraints.FreezeRotationZ;
	m_OrigGroundCheckDistance = m_GroundCheckDistance;
}



// convert the world relative moveInput vector into a local-relative turn amount 
// and forward amount required to head in the desired direction.
function Move (move:Vector3, jump:boolean, release:boolean, grapple:boolean, emotions:boolean[]) {

	// Recall that move is an X and Z only vector that is sum of camera direction and the 
	// inputs from the controller
	if (move.magnitude > 1.0) move.Normalize();
	// world space to local space (so what is the direction for the char)
	move = transform.InverseTransformDirection(move);
	// sets variables depending on whether this determines we are grounded or nah
	CheckGroundStatus();
	// this is so the vector is now moving along the ground plane that is current (or flatly, if midair)
	move = Vector3.ProjectOnPlane(move, m_GroundNormal);
	// going straight will only be in z direction, locally. so we have a turn degrees
	m_TurnAmount = Mathf.Atan2(move.x, move.z);
	m_ForwardAmount = move.z;
	ApplyExtraTurnRotation();

	// Handles inJump and delayed ability to jump after falling
	if (m_IsGrounded && delay <= 0) {
		inJump = false;
		bounce = false;
	}
	if (jump) {
		inJump = true;
	}

	// we have just moved into the air, but not by jumping
	// still doesn't work on running up ramps, but maybe thats fine
	if (last_Grounded == true && m_IsGrounded == false && !inJump && !bounce) {
		delay = delayVal;
	}

	// Might not be necessary
	if (last_Grounded == false && m_IsGrounded == true) {
		delay = 0;
	}

	last_Grounded = m_IsGrounded;
	// if it is less than some amount of time after leaving
	if (!m_IsGrounded && delay-- > 0 && !bounce) m_IsGrounded = true;
	// Don't be alarmed: delay will go far into negatives after jumping a while.
	//  Because it gets reset to delayVal this is fine

	// emotions
	m_Confuse = emotions[0];
	m_Glare   = emotions[1];
	m_Sad     = emotions[2];
	m_Happy   = emotions[3];
	m_Fight   = emotions[4];
	m_Shock   = emotions[5];
	m_Jig     = emotions[6];
	m_HairWhip= emotions[7];
	m_Flail   = emotions[8];
	m_FlailOff= emotions[9];
	m_JigOff  = emotions[10];

	// hair whip
	if (m_HairWhip) {
		// save the forward direction at the time of the hair whip so I can go back
		hairDirection = transform.rotation.eulerAngles;
	}
	// If whipping, rotate the character so the hair goes forward, but do it smoothly!
	if (m_Animator.GetCurrentAnimatorStateInfo(0).IsName("HairWhip")) {
		transform.rotation = Quaternion.Euler(Vector3(hairDirection.x,hairDirection.y-90*m_Animator.GetFloat("WhipAmount"),hairDirection.z));
	}

	// grapple
	m_Grapple = grapple;

	if (m_Animator.GetFloat("GrappleAmount") > 0.9 && queuedGrapple) {
		// Move right above the hit thing and set velocity to zero
		transform.position = grappleResult;
		m_Rigidbody.velocity = Vector3(0,0,0);
		m_IsGrounded = false;
		inJump = true; // Setting injump is what doesn't give the grace value
		queuedGrapple = false;
	}

	if (m_Grapple && m_IsGrounded) HandleGrapple();

	// am I adding more gravity or adding a jump, basically
	if (m_IsGrounded) {
		HandleGroundedMovement(jump);
	} else {
		HandleAirborneMovement();
	}

	StartDescent(release,bounce);

	// send input and other state parameters to the animator
	UpdateAnimator(move);
}

// Sets some variables depending on if the ground is within m_GroundCheckDistance
function CheckGroundStatus() {
	var hitInfo:RaycastHit;

	// we offset so that the ray doesn't start inside geometry we might be standing on
	if (Physics.Raycast(transform.position + (0.1*Vector3.up), Vector3.down, hitInfo, m_GroundCheckDistance)) {
		m_GroundNormal = hitInfo.normal;
		m_IsGrounded = true;
	} else {
		m_GroundNormal = Vector3.up;
		m_IsGrounded = false;
	}
}

function EnterBounce() {
	m_GroundCheckDistance = 0.01;
	bounce = true;
}

function ExitBounce() {
	m_GroundCheckDistance = 0.01;
	bounce = true;
}

function ApplyExtraTurnRotation() {
	// help the character turn faster (this is in addition to root rotation in the animation)
	// depending on how forward the guy is going it linearly interpolates between moving/not
	// when this is the same, this is a constant
	var turnSpeed: float = Mathf.Lerp(m_StationaryTurnSpeed, m_MovingTurnSpeed, m_ForwardAmount);
	transform.Rotate(0, m_TurnAmount * turnSpeed * Time.deltaTime, 0);
}

function HandleGrapple() {
	var hitInfo: RaycastHit;

	if (Physics.SphereCast(transform.position, collisionSphereVal, Vector3.up, hitInfo, 8))
	{
		grappleResult = hitInfo.point + Vector3(0,2,0);
		queuedGrapple = true;
		return true;
	}

	// We didn't hit anything
	return false;
}

function StartDescent(release:boolean,bounce:boolean) {
	if (release && !bounce && m_Rigidbody.velocity.y > 0) {
		m_Rigidbody.velocity = Vector3(m_Rigidbody.velocity.x, 0, m_Rigidbody.velocity.z);
	}
}

function OnAnimatorMove() {
	// we implement this function to override the default root motion.
	// this allows us to modify the positional speed before it's applied.
	if (Time.deltaTime > 0)
	{
		var vel: Vector3 = m_Rigidbody.velocity;

		vel = (m_Animator.GetFloat("Walkspeed") + 2*m_Animator.GetFloat("Runspeed")) * transform.forward * 1.6 * 2.8 * m_MoveSpeedMultiplier;
		// preserve y part so we can fall
		vel.y = m_Rigidbody.velocity.y;
		m_Rigidbody.velocity = vel;
	}
}

function UpdateAnimator(move:Vector3) {

	// Damp time seems interesting and valuable. makes the thing gradual
	m_Animator.SetFloat("Forward", m_ForwardAmount, 0.2, Time.deltaTime);
	m_Animator.SetBool("OnGround", m_IsGrounded);

	// Emotions
	if (m_IsGrounded) {
		if (m_Confuse) m_Animator.SetBool("Confuse", m_Confuse);
		if (m_Glare) m_Animator.SetBool("Glare", m_Glare);
		if (m_Sad) m_Animator.SetBool("Sad", m_Sad);
		if (m_Fight) m_Animator.SetBool("Fight", m_Fight);
		if (m_Shock) m_Animator.SetBool("Shock", m_Shock);
		if (m_Happy) m_Animator.SetBool("Happy", m_Happy);
		if (m_Jig)   m_Animator.SetBool("Jig", m_Jig);
		if (m_HairWhip) m_Animator.SetBool("HairWhip", m_HairWhip);
		if (m_JigOff) m_Animator.SetBool("JigOff", m_JigOff);

		// Grapple
		if (m_Grapple) {
			m_Animator.SetBool("Grapple", m_Grapple);
		}
	}

			if (m_Flail) m_Animator.SetBool("Flail", m_Flail);
		if (m_FlailOff) m_Animator.SetBool("FlailOff", m_FlailOff);

	// Switching to jump state
	if (!m_IsGrounded) {
		m_Animator.SetFloat("Jump", m_Rigidbody.velocity.y);
	}
	

	// the anim speed multiplier allows the overall speed of walking/running to be tweaked in the inspector,
	// which affects the movement speed because of the root motion.
	if (move.magnitude > 0) m_Animator.speed = m_AnimSpeedMultiplier;
}

function HandleAirborneMovement()
{
	// apply extra gravity from multiplier (regular gravity is added normally to rigidbody
	// this method could be deleted if I just fixed the gravity value...
	var extraGravityForce: Vector3 = (Physics.gravity * m_GravityMultiplier) - Physics.gravity;
	m_Rigidbody.AddForce(extraGravityForce);

	m_GroundCheckDistance = m_Rigidbody.velocity.y < 0 ? m_OrigGroundCheckDistance : 0.01;
}

function HandleGroundedMovement(jump:boolean)
{
	// check whether conditions are right to allow a jump (this is only called if on the ground)
	if (jump)
	{
		m_Rigidbody.velocity = new Vector3(m_Rigidbody.velocity.x, m_JumpPower, m_Rigidbody.velocity.z);
		m_IsGrounded = false;
		// m_Animator.applyRootMotion = false;
		m_GroundCheckDistance = 0.1; // this probably sets it up so the thing doesn't think we are grounded right away
	}
}

