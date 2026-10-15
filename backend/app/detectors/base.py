"""
Base Detector Protocol for ClearClick AI
"""

from abc import ABC, abstractmethod
from typing import List
from ..schema import PageData, Finding


class BaseDetector(ABC):
    category: str

    @abstractmethod
    def detect(self, page_data: PageData) -> List[Finding]:
        """Inspect page_data and return a list of findings matching the standard finding format."""
        pass
