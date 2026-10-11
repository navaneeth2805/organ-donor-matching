"""Graph Legend component for network visualization pages."""

import streamlit as st


def render_graph_legend() -> None:
    """Render visually clean, accessible badge-based legend for graph networks."""
    st.markdown(
        """
        <div style="background: #1E293B; border: 1px solid #334155; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; font-size: 0.84rem;">
            <div style="font-weight: 700; color: #94A3B8; text-transform: uppercase; font-size: 0.72rem; margin-bottom: 8px; letter-spacing: 0.05em;">
                Graph Network Legend & Notation
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 12px; height: 12px; background: #2563EB; border-radius: 50%;"></span>
                    <span style="color: #F8FAFC; font-weight: 600;">Donor Node (Partition 0)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 12px; height: 12px; background: #16A34A; border-radius: 50%;"></span>
                    <span style="color: #F8FAFC; font-weight: 600;">Recipient Node (Partition 1)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 22px; height: 3px; background: #94A3B8;"></span>
                    <span style="color: #CBD5E1;">Candidate Compatibility Edge</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 22px; height: 4px; background: #DC2626;"></span>
                    <span style="color: #FCA5A5; font-weight: 600;">Selected Matching Edge (Algorithm Choice)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 22px; height: 3px; border-top: 2px dashed #D97706;"></span>
                    <span style="color: #FCD34D;">Review Required Edge</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 22px; height: 4px; background: #EA580C;"></span>
                    <span style="color: #FDBA74; font-weight: 600;">Shortest Path Traversal</span>
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
