#pragma strict

var rewardCount: int = 0;
private var startup: Startup;
private var ready = false;

/* This script destroys rewards inside geometry */

function Awake () {
	var ground = GameObject.Find("Ground");
	startup = ground.GetComponent.<Startup>();
}

function OnTriggerEnter(other:Collider) {
	if (other.gameObject.tag != "Player") {
		startup.DecrementRewardCount();
		Destroy(this.gameObject);
	}
}