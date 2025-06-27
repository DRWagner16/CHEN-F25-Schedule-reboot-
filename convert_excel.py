# In convert_excel.py

import pandas as pd
import json
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime
import os
import sys # Import sys to allow the script to exit with an error code

# This function remains the same
def calculate_duration(time_str):
    if pd.isna(time_str) or time_str == "TBA" or '-' not in str(time_str):
        return None
    try:
        time_str = str(time_str).replace("AM", " AM").replace("PM", " PM")
        start_time_str, end_time_str = time_str.split('-')
        time_format = "%I:%M %p"
        start_time = datetime.strptime(start_time_str.strip(), time_format)
        end_time = datetime.strptime(end_time_str.strip(), time_format)
        duration = (end_time - start_time).total_seconds() / 60
        return int(duration)
    except (ValueError, AttributeError):
        return None

# This function has been updated with more logging and stricter error handling
def convert_gsheet_to_json():
    """
    Reads data from a Google Sheet, processes it, and saves it to a JSON file.
    """
    ########## UPDATE THESE VALUES FOR YOUR SETUP ##########
    google_sheet_name = 'Teaching Assignments 2025-2026' 
    worksheet_name = 'Fall Summary' 
    output_json_file = 'F25schedule.json'
    ########################################################
    
    try:
        print("[INFO] Authenticating with Google Sheets API...")
        google_creds_json = os.environ['GCP_SA_KEY']
        google_creds_dict = json.loads(google_creds_json)
        
        scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        creds = ServiceAccountCredentials.from_json_keyfile_dict(google_creds_dict, scope)
        client = gspread.authorize(creds)
        
        print(f"[INFO] Reading data from Google Sheet: '{google_sheet_name}' (Worksheet: '{worksheet_name}')...")
        sheet = client.open(google_sheet_name).worksheet(worksheet_name)
        
        # --- MODIFIED: This new logic finds the correct header row automatically ---
        print("[INFO] Fetching all values to locate the header row...")
        all_values = sheet.get_all_values()
        
        if not all_values:
            raise ValueError("The worksheet is empty.")

        header_row_index = -1
        # Find the row index that contains our main table headers
        for i, row in enumerate(all_values):
            if "COURSE" in row:
                header_row_index = i
                break
        
        if header_row_index == -1:
            raise ValueError("Could not find the header row containing 'COURSE'. Please ensure the column exists.")

        print(f"[INFO] Found data table starting at row {header_row_index + 1}.")
        header = all_values[header_row_index]
        data_rows = all_values[header_row_index + 1:]
        
        print(f"[DEBUG] Headers found: {header}")
        df = pd.DataFrame(data_rows, columns=header)
        # --- END MODIFICATION ---

        # Drop any rows where the 'COURSE' column is empty, to clean up blank rows
        df.dropna(subset=['COURSE'], inplace=True)
        df = df[df['COURSE'] != '']
        
        print(f"[DEBUG] Successfully loaded and cleaned {len(df.index)} rows.")

        print("[INFO] Setting course number...")
        df['course_number'] = df['COURSE'].astype(str)

        print("[INFO] Calculating class durations...")
        df['duration'] = df['TIME'].apply(calculate_duration)
        
        print("[INFO] Identifying and cleaning up unscheduled courses...")
        unscheduled_mask = df['duration'].isnull()
        df.loc[unscheduled_mask, 'TIME'] = 'Online/Asynchronous'
        df.loc[unscheduled_mask, 'DAYS'] = ''

        df = df.rename(columns={
            'INSTRUCTOR': 'instructors', 'DAYS': 'days', 'TIME': 'time_of_day',
            'LOCATION': 'location', 'TYPE': 'type', 'NOTES': 'notes',
            'ENROLL': 'anticipated_enrollment'
        })
        
        final_columns = [
            'course_number', 'instructors', 'days', 'time_of_day', 'duration', 
            'location', 'type', 'notes', 'anticipated_enrollment'
        ]
        for col in final_columns:
            if col not in df.columns:
                df[col] = ''
        df_final = df[final_columns]
        
        df_final = df_final.fillna({
            'instructors': 'TBD', 'days': '', 'time_of_day': 'TBD',
            'location': 'TBD', 'type': 'N/A', 'notes': '',
            'anticipated_enrollment': 0, 'duration': 0
        })

        schedule_data = df_final.to_dict(orient='records')
        
        with open(output_json_file, 'w') as f:
            json.dump(schedule_data, f, indent=4)
            
        print(f"\n[SUCCESS] Conversion complete! Data saved to '{output_json_file}'.")

    except Exception as e:
        print(f"[FATAL] An unexpected error occurred: {e}")
        sys.exit(1)


if __name__ == "__main__":
    convert_gsheet_to_json()
