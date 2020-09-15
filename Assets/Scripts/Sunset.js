#pragma strict

// This simulates a sun rising and setting
// Benefit is coolness
// Downside is shadows provide nice clue for grappling

/* This is currently disabled */

function Start() {
	// transform.Rotate(-90,0,0);
}

function Update () {
	transform.position = transform.position + Vector3(-10,0,0) * Time.deltaTime;	
}
