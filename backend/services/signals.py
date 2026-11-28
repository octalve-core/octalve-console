"""Retired legacy paid-flag receiver.

Invoice status alone is not proof of settlement. Service creation is owned by
the separately verified fulfillment worker, not Django post_save.
"""
