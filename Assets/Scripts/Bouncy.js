#pragma strict

private var script: TPChar;
private var audioo: AudioSource;

function Start () {
	audioo = GetComponent.<AudioSource>();
	var player = GameObject.Find("MainChar");
	for (var p: Transform in player.transform) {
        if (p.gameObject.activeSelf) {
            player = p.gameObject;
            break;
        }
    }
	script = player.GetComponent.<TPChar>();
}

function OnTriggerEnter(other:Collider) {
	var rb = other.gameObject.GetComponent.<Rigidbody>();
	rb.velocity = Vector3(0,0,0);
	script.EnterBounce();
	// This adds a constant upward impulse
	rb.AddForce(Vector3(0,20,0),ForceMode.Impulse);
	if (audioo) {
		audioo.Play(); // Boing!
	}
}

function OnTriggerExit(other:Collider) {
	script.ExitBounce();
}
