#!/usr/bin/env python3
"""Run the XLSXtoJSON automated test suite with useful default paths."""

import sys
import unittest
from pathlib import Path

TEST_DIR = Path(__file__).resolve().parent

if __name__ == "__main__":
    suite = unittest.defaultTestLoader.discover(str(TEST_DIR), pattern="test_*.py")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
