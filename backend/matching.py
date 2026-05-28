try:
    from .matching_score.scoring import calculate_investor_score
except ImportError:
    from matching_score.scoring import calculate_investor_score

__all__ = ["calculate_investor_score"]
