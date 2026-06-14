from datetime import datetime, timezone

from portfolio import db


class Project(db.Model):
    """Database model for portfolio projects, research, and experiments."""

    __tablename__ = "projects"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(
        db.String(50), nullable=False, default="Project"
    )  # e.g., 'Project', 'Research', 'Experiment'

    # Links
    url = db.Column(db.String(255), nullable=True)
    github_url = db.Column(db.String(255), nullable=True)

    # Metadata
    tags_string = db.Column(db.String(255), nullable=True)  # Comma-separated list of tags
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    @property
    def tags(self):
        """Helper to get tags as a Python list."""
        if not self.tags_string:
            return []
        return [tag.strip() for tag in self.tags_string.split(",") if tag.strip()]

    @tags.setter
    def tags(self, tag_list):
        """Helper to set tags from a Python list."""
        if not tag_list:
            self.tags_string = ""
        else:
            self.tags_string = ",".join(tag_list)

    def __repr__(self):
        return f"<Project {self.title}>"
