"""Streamlit rendering utilities for PyVis interactive HTML graphs."""

import streamlit as st
import streamlit.components.v1 as components


def render_pyvis_in_streamlit(html_str: str, height: int = 650) -> None:
    """Embed the Vis.js interactive graph within a Streamlit iframe safely."""
    components.html(html_str, height=height, scrolling=False)


def render_html_export_button(html_str: str, file_name: str = "organ_donor_graph_network.html") -> None:
    """Provide a download button to export the standalone interactive HTML graph."""
    st.download_button(
        label="📥 Export Interactive Graph (HTML)",
        data=html_str,
        file_name=file_name,
        mime="text/html",
        use_container_width=True,
    )
