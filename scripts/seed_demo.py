"""
Compatibility wrapper for the current no-auth Firebase seed.

Dry run:
    python -m scripts.seed_demo

Apply reset/reseed:
    python -m scripts.seed_demo --apply
"""

from scripts.reconstruct_firebase import main


if __name__ == "__main__":
    main()
