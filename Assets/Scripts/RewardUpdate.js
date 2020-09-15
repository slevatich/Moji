#pragma strict

var score: int = 0;
var text: GameObject;
private var audioo: AudioSource;
private var deathTime = false;
private var deathNum: float = 0;

/* This script handles the player hitting things: so rewards and dying */

function Start() {
	audioo = GetComponent.<AudioSource>();
}

function Update() {
	if (deathTime) {
		deathNum += Time.deltaTime;
		if (deathNum > 2) {
			// We have been dead two seconds! Reset!
			text.GetComponent.<UnityEngine.UI.Text>().text = "";
			transform.position = Vector3(0,5,0);
			transform.localScale = new Vector3(1,1,1);
			deathTime = false;
			deathNum = 0;
			GetComponent.<Rigidbody>().useGravity = true;
		}
	}
}

function OnTriggerEnter(other:Collider) {
	if (other.gameObject.tag == "Hazard") {
		// Character is movable but unseeable. Two second respawn delay engaged
		text.GetComponent.<UnityEngine.UI.Text>().text = "OOPS! TRY AGAIN, MOJI!";
		transform.localScale = new Vector3(0, 0, 0);
		GetComponent.<Rigidbody>().velocity = Vector3(0,0,0);
		GetComponent.<Rigidbody>().useGravity = false;
		deathTime = true;
	} else  if (other.gameObject.tag == "Reward") {
		score++;
		audioo.pitch = 1;
		audioo.Play();
		Destroy (other.gameObject);
	} else if (other.gameObject.tag == "BigReward") {
		score++;
		audioo.pitch = 2; // its a higher pitch for the better reward!
		audioo.Play();
		Destroy (other.gameObject);
	}
}