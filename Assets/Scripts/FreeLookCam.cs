using System;
using UnityEngine;
using UnityStandardAssets.CrossPlatformInput;

/* This script is a modified version of the standard assets FreeLookCam (hence being in CSharp) */

namespace UnityStandardAssets.Cameras
{
    public class FreeLookCam : PivotBasedCameraRig
    {
        // This script is designed to be placed on the root object of a camera rig,
        // comprising 3 gameobjects, each parented to the next:

        //  Camera Rig
        //      Pivot
        //          Camera

        [SerializeField] private float m_MoveSpeed = 1f;                      // How fast the rig will move to keep up with the target's position.
        [Range(0f, 10f)] [SerializeField] private float m_TurnSpeed = 0f;     // How fast the rig will rotate from user input.
        [SerializeField] private float m_TurnSmoothing = 0.1f;                // How much smoothing to apply to the turn input, to reduce mouse-turn jerkiness
        [SerializeField] private float m_TiltMax = 75f;                       // The maximum value of the x axis rotation of the pivot.
        [SerializeField] private float m_TiltMin = 45f;                       // The minimum value of the x axis rotation of the pivot.
        [SerializeField] private bool m_LockCursor = false;                   // Whether the cursor should be hidden and locked.
        [SerializeField] private bool m_VerticalAutoReturn = false;           // set wether or not the vertical axis should auto return

        public GameObject mask; // this one is the middle
        public GameObject mask2;
        public GameObject mask3;

        private float m_LookAngle;                    // The rig's y axis rotation.
        private float m_TiltAngle;                    // The pivot's x axis rotation.
        private const float k_LookDistance = 300f;    // How far in front of the pivot the character's look target is.
        private Vector3 m_PivotEulers;
        private Quaternion m_PivotTargetRot;
        private Quaternion m_TransformTargetRot;

        // My variable additions
        private bool arrowKeyTurning = true;           // do arrow keys control camera or moving char?
        private float x = 0;
        private float y = 0;
        private float saved_LA = 0;
        private bool selfie = false;
        private int count = 0;
        private bool dimmed = false;
        private Vector3 lastPosition;

        protected override void Awake()
        {

            foreach (Transform p in m_Target) {
                if (p.gameObject.activeSelf) {
                    m_Target = p;
                    break;
                }
            }

            base.Awake();
            // Lock or unlock the cursor.
            Cursor.lockState = m_LockCursor ? CursorLockMode.Locked : CursorLockMode.None;
            Cursor.visible = !m_LockCursor;
            m_PivotEulers = m_Pivot.rotation.eulerAngles;

            m_PivotTargetRot = m_Pivot.transform.localRotation;
            m_TransformTargetRot = transform.localRotation;

            lastPosition = m_Target.position;

            if (Input.GetJoystickNames().Length > 0) {
                arrowKeyTurning = false;
            }
        }


        protected void Update()
        {
            bool maskOn = CrossPlatformInputManager.GetButtonDown("Selfie");
            bool maskOff = CrossPlatformInputManager.GetButtonUp("Selfie");
            bool snap = false;
            bool snapOff = false;
            if (selfie) {
                snap = CrossPlatformInputManager.GetButtonDown("Snapshot");
                snapOff = CrossPlatformInputManager.GetButtonUp("Snapshot");
            }

            HandleRotationMovement(maskOn, maskOff, snap, snapOff);

            if (m_LockCursor && Input.GetMouseButtonUp(0)) {
                Cursor.lockState = m_LockCursor ? CursorLockMode.Locked : CursorLockMode.None;
                Cursor.visible = !m_LockCursor;
            }
        }


        private void OnDisable()
        {
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }


        protected override void FollowTarget(float deltaTime)
        {
            if (m_Target == null) return;
            // Move the rig towards target position.
            if (!selfie) {
                transform.position = Vector3.Lerp(transform.position, m_Target.position, deltaTime*m_MoveSpeed);
                // transform.position = m_Target.position;
            } else {
                // TODO: figure out zoom and cameras in general
                transform.position = m_Target.position + Vector3.Normalize(m_Target.forward) + Vector3.down;
            }
        }


        private void HandleRotationMovement(bool maskOn, bool maskOff, bool snap, bool snapOff)
        {
            if(Time.timeScale < float.Epsilon)
            return;

            // Read the user input
            if (!arrowKeyTurning) {
                x = CrossPlatformInputManager.GetAxis("Mouse X");
                y = CrossPlatformInputManager.GetAxis("Mouse Y");
            } else {
                if (Input.GetKey(KeyCode.LeftArrow)) {
                    x -= 0.1f;
                } else if (Input.GetKey(KeyCode.RightArrow)) {
                    x += 0.1f;
                } else {
                    x = 0;
                }
                if (Input.GetKey(KeyCode.UpArrow)) {
                    y += 0.1f;
                } else if (Input.GetKey(KeyCode.DownArrow)) {
                    y -= 0.1f;
                } else {
                    y = 0;
                }
            }

            // Where do I want photos to go?
            if (m_TurnSmoothing < 6) m_TurnSmoothing++;
            if (dimmed) {
                mask.GetComponent<UnityEngine.UI.Image>().fillCenter = true;
                dimmed = false;
            }
            if (snap) {
                count++;
                String s = String.Concat("Snappychat_",count.ToString());
                s = String.Concat(s,".png");
                Application.CaptureScreenshot(s);
                GetComponent<AudioSource>().Play();
                dimmed = true;
            }
            if (snapOff) {
                mask.GetComponent<UnityEngine.UI.Image>().fillCenter = false;
            }

            if (maskOn) {
                mask.GetComponent<UnityEngine.UI.Image>().fillCenter = false;
                saved_LA = m_LookAngle;
                m_LookAngle = m_Target.rotation.eulerAngles.y - 90;
                m_TiltAngle = 0;
                m_TurnSmoothing = 0;
                selfie = true;
                mask.SetActive(true);
                mask2.SetActive(true);
                mask3.SetActive(true);
                m_Cam.gameObject.GetComponent<Camera>().fieldOfView = 30;
            }

            if (maskOff) {
                selfie = false;
                m_TurnSmoothing = 0;
                m_LookAngle = saved_LA;
                mask.SetActive(false);
                mask2.SetActive(false);
                mask3.SetActive(false);
                m_Cam.gameObject.GetComponent<Camera>().fieldOfView = 60;
            }


            // HORIZONTAL TILT

            // Have the camera drift toward the proper position
            Vector3 deltaPos = m_Target.position - lastPosition;
            float deltaY = deltaPos.y;
            deltaPos.y = 0;
            if (deltaPos.magnitude > 0.01) {
                // deltaPos = Vector3.Normalize(deltaPos);
                float m_LookAngleTarget = (Quaternion.LookRotation(deltaPos).eulerAngles.y + 90) % 360;

                if (m_LookAngle - m_LookAngleTarget > 180) {
                    m_LookAngleTarget += 360;
                } else if (m_LookAngle - m_LookAngleTarget < -180) {
                    m_LookAngleTarget -= 360;
                }

                if (Mathf.Abs(m_LookAngle - m_LookAngleTarget) < 100) {
                    m_LookAngle = Mathf.Lerp(m_LookAngle, m_LookAngleTarget, Time.deltaTime);
                }
            }

            // Adjust the look angle by an amount proportional to the turn speed and horizontal input.
            m_LookAngle += x*m_TurnSpeed;
            m_LookAngle %= 360;

            // Rotate the rig (the root object) around Y axis only:
            m_TransformTargetRot = Quaternion.Euler(0f, m_LookAngle, 0f);


            // Vertical TILT

            if (deltaY > 0.1 || deltaY < -0.1) {
                m_TiltAngle += deltaY * 5;
            }

            // on platforms with a mouse, we adjust the current angle based on Y mouse input and turn speed
            m_TiltAngle -= y*m_TurnSpeed;
            m_TiltAngle = Mathf.Clamp(m_TiltAngle, -m_TiltMin, m_TiltMax);
            m_TiltAngle %= 360;

            // Tilt input around X is applied to the pivot (the child of this object)
            m_PivotTargetRot = Quaternion.Euler(m_TiltAngle, m_PivotEulers.y , m_PivotEulers.z);


            // Smoothly transition

            if (m_TurnSmoothing > 0)
            {
                m_Pivot.localRotation = Quaternion.Slerp(m_Pivot.localRotation, m_PivotTargetRot, m_TurnSmoothing * Time.deltaTime);
                transform.localRotation = Quaternion.Slerp(transform.localRotation, m_TransformTargetRot, m_TurnSmoothing * Time.deltaTime);
            }
            else
            {
                m_Pivot.localRotation = m_PivotTargetRot;
                transform.localRotation = m_TransformTargetRot;
            }


            lastPosition = m_Target.position;
        }
    }
}
