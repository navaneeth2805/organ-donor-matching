"""Hospital partner network management interface for facilities and transplant centers."""

from datetime import date
import pandas as pd
import streamlit as st
from modules.hospital import HospitalService
from ui.components import render_empty_state, render_page_header, render_section_header
from utils.exceptions import DuplicateRecordError, ValidationError
from utils.export import export_hospitals_csv


def render_hospital_page(hospital_service: HospitalService) -> None:
    """Render hospital management interface."""
    render_page_header(
        title="Hospital & Transplant Center Directory",
        description="Manage participating healthcare facilities, procurement centers, and regional transplant networks.",
    )

    tab_view, tab_add, tab_edit = st.tabs(["🏥 Partner Facilities", "➕ Add Facility", "⚙️ Manage / Toggle Facility"])

    # ---------------------------------------------------------
    # TAB 1: FACILITY DIRECTORY & SEARCH
    # ---------------------------------------------------------
    with tab_view:
        col_s1, col_s2 = st.columns([3, 1])
        with col_s1:
            search_query = st.text_input("Search Facilities", placeholder="Search by Hospital Name, City, or State...")
        with col_s2:
            show_active_only = st.checkbox("Active Facilities Only", value=False)

        hospitals = hospital_service.search_hospitals(search_query, active_only=show_active_only)
        st.markdown(f"**Found {len(hospitals)} registered facilities**")

        if hospitals:
            hosp_rows = []
            for h in hospitals:
                hosp_rows.append({
                    "ID": h.id,
                    "Facility Name": h.name,
                    "City": h.city,
                    "State": h.state,
                    "Country": h.country,
                    "Phone": h.phone or "N/A",
                    "Email": h.email or "N/A",
                    "Status": "🟢 Active" if h.active else "⏸️ Inactive",
                })
            df_display = pd.DataFrame(hosp_rows)
            st.dataframe(df_display, use_container_width=True, hide_index=True)

            csv_data = export_hospitals_csv(hospitals)
            st.download_button(
                label="📥 Download Facilities CSV",
                data=csv_data,
                file_name=f"hospitals_export_{date.today().isoformat()}.csv",
                mime="text/csv",
            )
        else:
            render_empty_state("No healthcare facilities found matching your search.")

    # ---------------------------------------------------------
    # TAB 2: REGISTER FACILITY
    # ---------------------------------------------------------
    with tab_add:
        render_section_header("Register New Healthcare Facility", icon="🏥")
        with st.form("add_hospital_form", clear_on_submit=True):
            col1, col2 = st.columns(2)
            with col1:
                name = st.text_input("Facility Name *", placeholder="e.g. All India Institute of Medical Sciences (AIIMS)")
                city = st.text_input("City *", placeholder="e.g. New Delhi")
                state = st.text_input("State *", placeholder="e.g. Delhi")
            with col2:
                country = st.text_input("Country *", value="India")
                phone = st.text_input("Contact Phone", placeholder="e.g. +91 11 26588500")
                email = st.text_input("Contact Email", placeholder="e.g. transplant@aiims.edu")
                is_active = st.checkbox("Mark as Active Transplant Partner", value=True)

            submitted = st.form_submit_button("✅ Register Facility", use_container_width=True)
            if submitted:
                try:
                    hospital_service.add_hospital(
                        name=name,
                        city=city,
                        state=state,
                        country=country,
                        phone=phone or None,
                        email=email or None,
                        active=1 if is_active else 0,
                    )
                    st.success(f"Hospital '{name}' registered successfully.")
                    st.rerun()
                except DuplicateRecordError as d_err:
                    st.error(f"Duplicate Error: {d_err}")
                except ValidationError as v_err:
                    st.error(f"Validation Error: {v_err}")
                except Exception as ex:
                    st.error(f"Registration failed: {ex}")

    # ---------------------------------------------------------
    # TAB 3: MANAGE / TOGGLE FACILITY
    # ---------------------------------------------------------
    with tab_edit:
        render_section_header("Update Facility Details & Status", icon="⚙️")
        all_hospitals = hospital_service.list_hospitals()
        if not all_hospitals:
            render_empty_state("No facilities currently registered.")
        else:
            hosp_map = {f"{h.name} ({h.city}) - {'Active' if h.active else 'Inactive'}": h.id for h in all_hospitals}
            selected_label = st.selectbox("Select Facility to Manage", list(hosp_map.keys()))
            target_id = hosp_map[selected_label]
            target_hosp = hospital_service.get_hospital_by_id(target_id)

            with st.form("edit_hospital_form"):
                col1, col2 = st.columns(2)
                with col1:
                    edit_name = st.text_input("Facility Name *", value=target_hosp.name)
                    edit_city = st.text_input("City *", value=target_hosp.city)
                    edit_state = st.text_input("State *", value=target_hosp.state)
                with col2:
                    edit_country = st.text_input("Country *", value=target_hosp.country)
                    edit_phone = st.text_input("Phone", value=target_hosp.phone or "")
                    edit_email = st.text_input("Email", value=target_hosp.email or "")
                    edit_active = st.checkbox("Active Facility", value=bool(target_hosp.active))

                save_btn = st.form_submit_button("💾 Save Facility Updates", use_container_width=True)
                if save_btn:
                    try:
                        hospital_service.update_hospital(
                            hospital_id=target_hosp.id,
                            name=edit_name,
                            city=edit_city,
                            state=edit_state,
                            country=edit_country,
                            phone=edit_phone or None,
                            email=edit_email or None,
                            active=1 if edit_active else 0,
                        )
                        st.success(f"Hospital '{edit_name}' updated successfully.")
                        st.rerun()
                    except ValidationError as v_err:
                        st.error(f"Validation Error: {v_err}")
                    except Exception as ex:
                        st.error(f"Update failed: {ex}")

            st.markdown("---")
            render_section_header("Deactivation & Status Controls", icon="🛡️")
            col_t1, col_t2 = st.columns(2)
            with col_t1:
                new_state = not bool(target_hosp.active)
                toggle_label = "Activate Facility" if new_state else "Deactivate Facility"
                if st.button(f"🔄 {toggle_label}", use_container_width=True):
                    hospital_service.toggle_active(target_hosp.id, new_state)
                    st.success(f"Facility status toggled to {'Active' if new_state else 'Inactive'}.")
                    st.rerun()

            with col_t2:
                if st.button("🗑️ Attempt Safe Deletion", use_container_width=True):
                    try:
                        deleted = hospital_service.delete_hospital(target_hosp.id)
                        if deleted:
                            st.success("Facility deleted.")
                            st.rerun()
                    except Exception as ex:
                        st.warning(f"Could not delete: {ex}. Please deactivate the facility instead.")
