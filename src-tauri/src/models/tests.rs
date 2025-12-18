//! Property tests for state machine transitions
//! 
//! **Feature: MediaGrab, Property 2: State Machine Transition Validity**
//! **Validates: Requirements 1.4, 4.6**

use super::DownloadState;
use proptest::prelude::*;

/// Generate arbitrary DownloadState values
fn arb_download_state() -> impl Strategy<Value = DownloadState> {
    prop_oneof![
        Just(DownloadState::Idle),
        Just(DownloadState::Analyzing),
        Just(DownloadState::Starting),
        Just(DownloadState::Downloading),
        Just(DownloadState::Merging),
        Just(DownloadState::Completed),
        Just(DownloadState::Cancelled),
        Just(DownloadState::Cancelling),
        Just(DownloadState::Failed),
    ]
}

/// All valid state transitions as defined in the state diagram
const VALID_TRANSITIONS: &[(DownloadState, DownloadState)] = &[
    // From Idle
    (DownloadState::Idle, DownloadState::Analyzing),
    (DownloadState::Idle, DownloadState::Starting),
    // From Analyzing
    (DownloadState::Analyzing, DownloadState::Idle),
    (DownloadState::Analyzing, DownloadState::Starting),
    (DownloadState::Analyzing, DownloadState::Failed),
    // From Starting
    (DownloadState::Starting, DownloadState::Downloading),
    (DownloadState::Starting, DownloadState::Failed),
    // From Downloading
    (DownloadState::Downloading, DownloadState::Merging),
    (DownloadState::Downloading, DownloadState::Completed),
    (DownloadState::Downloading, DownloadState::Cancelling),
    (DownloadState::Downloading, DownloadState::Failed),
    // From Merging
    (DownloadState::Merging, DownloadState::Completed),
    (DownloadState::Merging, DownloadState::Cancelling),
    (DownloadState::Merging, DownloadState::Failed),
    // From Cancelling
    (DownloadState::Cancelling, DownloadState::Cancelled),
    // Reset transitions
    (DownloadState::Completed, DownloadState::Idle),
    (DownloadState::Cancelled, DownloadState::Idle),
    (DownloadState::Failed, DownloadState::Idle),
];

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    /// **Feature: MediaGrab, Property 2: State Machine Transition Validity**
    /// 
    /// For any sequence of state transitions, the download state machine SHALL only 
    /// allow valid transitions as defined in the state diagram. Invalid transition 
    /// attempts SHALL be rejected and the current state SHALL remain unchanged.
    #[test]
    fn prop_state_machine_only_allows_valid_transitions(
        from in arb_download_state(),
        to in arb_download_state()
    ) {
        let is_valid_transition = VALID_TRANSITIONS.contains(&(from, to));
        let can_transition = from.can_transition_to(to);
        
        // The state machine should correctly identify valid transitions
        prop_assert_eq!(
            can_transition, 
            is_valid_transition,
            "Transition {:?} -> {:?}: can_transition={}, expected={}",
            from, to, can_transition, is_valid_transition
        );
    }
    
    /// Property: Invalid transitions should preserve the current state
    #[test]
    fn prop_invalid_transition_preserves_state(
        from in arb_download_state(),
        to in arb_download_state()
    ) {
        let result = from.transition_to(to);
        let is_valid = VALID_TRANSITIONS.contains(&(from, to));
        
        if is_valid {
            // Valid transition should return Ok with the new state
            prop_assert_eq!(result, Ok(to));
        } else {
            // Invalid transition should return Err with the original state
            prop_assert_eq!(result, Err(from));
        }
    }
    
    /// Property: Active states are correctly identified
    #[test]
    fn prop_active_states_correctly_identified(state in arb_download_state()) {
        let is_active = state.is_active();
        let expected_active = matches!(
            state,
            DownloadState::Analyzing | 
            DownloadState::Starting | 
            DownloadState::Downloading | 
            DownloadState::Merging | 
            DownloadState::Cancelling
        );
        
        prop_assert_eq!(is_active, expected_active);
    }
}

#[cfg(test)]
mod unit_tests {
    use super::*;
    
    #[test]
    fn test_default_state_is_idle() {
        assert_eq!(DownloadState::default(), DownloadState::Idle);
    }
    
    #[test]
    fn test_cancel_flow() {
        let state = DownloadState::Downloading;
        let state = state.transition_to(DownloadState::Cancelling).unwrap();
        let state = state.transition_to(DownloadState::Cancelled).unwrap();
        let state = state.transition_to(DownloadState::Idle).unwrap();
        assert_eq!(state, DownloadState::Idle);
    }
    
    #[test]
    fn test_successful_download_flow() {
        let state = DownloadState::Idle;
        let state = state.transition_to(DownloadState::Starting).unwrap();
        let state = state.transition_to(DownloadState::Downloading).unwrap();
        let state = state.transition_to(DownloadState::Merging).unwrap();
        let state = state.transition_to(DownloadState::Completed).unwrap();
        let state = state.transition_to(DownloadState::Idle).unwrap();
        assert_eq!(state, DownloadState::Idle);
    }
    
    #[test]
    fn test_cannot_start_while_downloading() {
        let state = DownloadState::Downloading;
        let result = state.transition_to(DownloadState::Starting);
        assert_eq!(result, Err(DownloadState::Downloading));
    }
}
