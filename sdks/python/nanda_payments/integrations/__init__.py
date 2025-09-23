"""
Framework integrations for NANDA Payments SDK
"""

# Framework integrations are optional and only available if the framework is installed
try:
    from .fastapi import NandaPaymentsDependency, payment_required
    __all__ = ["NandaPaymentsDependency", "payment_required"]
except ImportError:
    __all__ = []

try:
    from .django import NandaPaymentsMiddleware
    __all__.append("NandaPaymentsMiddleware")
except ImportError:
    pass

try:
    from .flask import NandaPaymentsFlask
    __all__.append("NandaPaymentsFlask")
except ImportError:
    pass