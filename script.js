// In script.js

document.addEventListener('DOMContentLoaded', () => {
    const calendarGrid = document.querySelector('.calendar-grid');
    const timeColumn = document.querySelector('.time-column');
    const instructorFilter = document.getElementById('instructor-filter');
    const typeFilter = document.getElementById('type-filter');
    const locationFilter = document.getElementById('location-filter');
    const courseCheckboxesContainer = document.getElementById('course-checkboxes');
    const resetBtn = document.getElementById('reset-filters');
    const showAllChenBtn = document.getElementById('show-all-chen-btn');
    const unscheduledCoursesList = document.getElementById('unscheduled-courses-list');
    const courseTableBody = document.getElementById('course-table-body');

    const START_HOUR = 7;
    const END_HOUR = 20;
    const dayMap = { 'M': 'Mo', 'T': 'Tu', 'W': 'We', 'R': 'Th', 'F': 'Fr' };
    let allCourses = [];
    const courseColorMap = new Map();

    generateTimeSlots();
    fetchDataAndInitialize();

    instructorFilter.addEventListener('change', () => {
        const selectedInstructor = instructorFilter.value;
        if (selectedInstructor === 'all') {
            filterAndRedrawCalendar();
            return;
        }
        typeFilter.value = 'all';
        locationFilter.value = 'all';
        document.querySelectorAll('#course-checkboxes input[type="checkbox"]').forEach(cb => {
            const course = allCourses.find(c => c.course_number === cb.value);
            if (course && course.instructors.includes(selectedInstructor)) {
                cb.checked = true;
            } else {
                cb.checked = false;
            }
        });
        filterAndRedrawCalendar();
    });

    typeFilter.addEventListener('change', () => {
        const selectedType = typeFilter.value;
        if (selectedType === 'all') {
            filterAndRedrawCalendar();
            return;
        }
        instructorFilter.value = 'all';
        locationFilter.value = 'all';
        document.querySelectorAll('#course-checkboxes input[type="checkbox"]').forEach(cb => {
            const course = allCourses.find(c => c.course_number === cb.value);
            if (course && course.type === selectedType) {
                cb.checked = true;
            } else {
                cb.checked = false;
            }
        });
        filterAndRedrawCalendar();
    });

    locationFilter.addEventListener('change', filterAndRedrawCalendar);
    courseCheckboxesContainer.addEventListener('change', filterAndRedrawCalendar);

    resetBtn.addEventListener('click', () => {
        instructorFilter.value = 'all';
        typeFilter.value = 'all';
        locationFilter.value = 'all';
        document.querySelectorAll('#course-checkboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
        filterAndRedrawCalendar();
    });

    showAllChenBtn.addEventListener('click', () => {
        instructorFilter.value = 'all';
        typeFilter.value = 'all';
        locationFilter.value = 'all';
        document.querySelectorAll('#course-checkboxes input[type="checkbox"]').forEach(cb => {
            if (cb.value.startsWith("CH EN")) {
                cb.checked = true;
            } else {
                cb.checked = false;
            }
        });
        filterAndRedrawCalendar();
    });

    // --- MODIFIED --- This function now has greater variation in saturation and lightness.
    function courseToHslColor(course) {
        const typeBaseHues = {
            'Year 1': 103,   // Mountain Green
            'Year 2': 180,   // Great Salt Lake
            'Year 3': 41,    // Wasatch Sunrise
            'Year 4': 0,     // Utah Red
            'Elective': 196, // Granite Peak
            'Graduate': 30,  // Orange
            'Other': 230,    // Blue
        };
        
        let baseHue = typeBaseHues[course.type] ?? 0;
        
        // Default to gray for unknown types
        if (typeBaseHues[course.type] === undefined) {
            baseHue = 0;
        }

        let hash = 0;
        const str = course.course_number;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }

        // Generate saturation and lightness from the hash for more variety
        const saturation = 50 + (Math.abs(hash) % 35); // Range: 55-84%
        const lightness = 50 + (Math.abs(hash >> 8) % 35); // Range: 65-79%

        // If the type was unknown, force saturation to 0 for a grayscale color
        const finalSaturation = typeBaseHues[course.type] === undefined ? 0 : saturation;

        return `hsl(${baseHue}, ${finalSaturation}%, ${lightness}%)`;
    }

    function generateTimeSlots() {
        for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.classList.add('time-slot');
            timeSlot.innerText = `${hour}:00`;
            timeColumn.appendChild(timeSlot);
        }
    }

    function fetchDataAndInitialize() {
        fetch('F25schedule.json')
            .then(response => response.json())
            .then(data => {
                allCourses = data.map(course => {
                    const timeString = course.time_of_day;
                    if (!timeString || !timeString.match(/(\d{1,2}:\d{2})(AM|PM)/)) {
                        return { ...course, startMinutes: null, endMinutes: null };
                    }
                    const timeParts = timeString.match(/(\d{1,2}:\d{2})(AM|PM)/);
                    const [time, ampm] = [timeParts[1], timeParts[2]];
                    let [hour, minute] = time.split(':').map(Number);
                    if (ampm === 'PM' && hour !== 12) hour += 12;
                    if (ampm === 'AM' && hour === 12) hour = 0;
                    const startMinutes = (hour * 60) + minute;
                    const endMinutes = startMinutes + course.duration;
                    return { ...course, startMinutes, endMinutes };
                });
                
                populateFilters(allCourses);
                filterAndRedrawCalendar();
            })
            .catch(error => console.error('[FATAL] Error loading schedule data:', error));
    }
    
    function populateFilters(courses) {
        courseColorMap.clear();
        courses.forEach(course => {
            if (!courseColorMap.has(course.course_number)) {
                courseColorMap.set(course.course_number, courseToHslColor(course));
            }
        });
        const uniqueCourses = [...new Set(courses.map(course => course.course_number))].sort();
        const allInstructorNames = courses.flatMap(course => course.instructors.split(';').map(name => name.trim()));
        const uniqueInstructors = [...new Set(allInstructorNames)].sort();
        uniqueInstructors.forEach(name => {
            if (name && name.toLowerCase() !== 'nan') {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                instructorFilter.appendChild(option);
            }
        });
        const uniqueTypes = [...new Set(courses.map(course => course.type))].sort();
        uniqueTypes.forEach(typeName => {
            if (typeName && typeName.toLowerCase() !== 'nan') {
                const option = document.createElement('option');
                option.value = typeName;
                option.textContent = typeName;
                typeFilter.appendChild(option);
            }
        });
        const allLocationNames = courses.flatMap(course => (course.location || '').split(';').map(name => name.trim()));
        const uniqueLocations = [...new Set(allLocationNames)].sort();
        uniqueLocations.forEach(locationName => {
            if (locationName && locationName.toLowerCase() !== 'nan') {
                const option = document.createElement('option');
                option.value = locationName;
                option.textContent = locationName;
                locationFilter.appendChild(option);
            }
        });
        uniqueCourses.forEach(courseName => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'checkbox-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = courseName;
            checkbox.value = courseName;
            const label = document.createElement('label');
            label.htmlFor = courseName;
            label.textContent = courseName;
            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(label);
            courseCheckboxesContainer.appendChild(itemDiv);
        });
    }

    function filterAndRedrawCalendar() {
        const selectedInstructor = instructorFilter.value;
        const selectedType = typeFilter.value;
        const selectedLocation = locationFilter.value;
        const selectedCourses = Array.from(document.querySelectorAll('#course-checkboxes input:checked')).map(cb => cb.value);
        const filteredCourses = allCourses.filter(course => {
            const instructorMatch = (selectedInstructor === 'all' || (course.instructors && course.instructors.includes(selectedInstructor)));
            const typeMatch = (selectedType === 'all' || course.type === selectedType);
            const locationMatch = (selectedLocation === 'all' || (course.location && course.location.includes(selectedLocation)));
            const courseMatch = (selectedCourses.length === 0 || selectedCourses.includes(course.course_number));
            return instructorMatch && typeMatch && courseMatch && locationMatch;
        });
        const schedulableCourses = filteredCourses.filter(c => c.startMinutes !== null && c.days && c.days.trim() !== '');
        const unschedulableCourses = filteredCourses.filter(c => c.startMinutes === null || !c.days || c.days.trim() === '');
        
        updateCoursesTable(filteredCourses);
        calculateAndDisplayMetrics(schedulableCourses);
        displayUnscheduledCourses(unschedulableCourses);
        
        document.querySelectorAll('.day-content').forEach(dc => dc.innerHTML = '');

        Object.values(dayMap).forEach(dayCode => {
            const dayEvents = schedulableCourses
                .filter(course => course.days.includes(Object.keys(dayMap).find(key => dayMap[key] === dayCode)))
                .sort((a, b) => a.startMinutes - b.startMinutes);
            if (dayEvents.length === 0) return;
            let columns = [];
            dayEvents.forEach(event => {
                let placed = false;
                for (const column of columns) {
                    const lastEventInColumn = column[column.length - 1];
                    if (event.startMinutes >= lastEventInColumn.endMinutes) {
                        column.push(event);
                        placed = true;
                        break;
                    }
                }
                if (!placed) columns.push([event]);
            });
            const totalColumns = columns.length;
            columns.forEach((column, columnIndex) => {
                column.forEach(event => {
                    const width = 100 / totalColumns;
                    const left = columnIndex * width;
                    placeCourseOnCalendar(event, dayCode, width, left);
                });
            });
        });
    }

    function updateCoursesTable(courses) {
        courseTableBody.innerHTML = '';
        const chenCourses = courses.filter(course => course.course_number.startsWith("CH EN"));
        if (chenCourses.length === 0) {
            const row = courseTableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 8;
            cell.textContent = 'No CH EN courses match the current filter selection.';
            cell.style.textAlign = 'center';
            return;
        }
        chenCourses.forEach(course => {
            const row = courseTableBody.insertRow();
            row.insertCell().textContent = course.course_number || '';
            row.insertCell().textContent = course.type || '';
            row.insertCell().textContent = course.time_of_day || '';
            row.insertCell().textContent = course.days || '';
            row.insertCell().textContent = course.instructors || '';
            row.insertCell().textContent = course.location || '';
            row.insertCell().textContent = course.anticipated_enrollment || 0;
            row.insertCell().textContent = course.notes || '';
        });
    }

    function displayUnscheduledCourses(courses) {
        unscheduledCoursesList.innerHTML = '';
        if (courses.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No selected courses without a fixed schedule.';
            li.style.fontStyle = 'italic';
            unscheduledCoursesList.appendChild(li);
            return;
        }
        courses.forEach(course => {
            const li = document.createElement('li');
            li.innerHTML = `
                <strong>${course.course_number} (${course.type || 'N/A'})</strong><br>
                Instructor(s): ${course.instructors || 'N/A'}<br>
                Location: ${course.location || 'N/A'}<br>
                ${course.notes ? `Notes: ${course.notes}` : ''}
            `;
            unscheduledCoursesList.appendChild(li);
        });
    }

    function calculateAndDisplayMetrics(courses) {
        const primeTimeStart = 9 * 60;
        const primeTimeEnd = 14 * 60;
        let mebRoomUsageMinutes = { "MEB 1292": 0, "MEB 2550": 0, "MEB 3520": 0 };
        let mwfPrimeTimeMinutes = 0;
        let trPrimeTimeMinutes = 0;
        let dailyMinutes = { Mo: 0, Tu: 0, We: 0, Th: 0, Fr: 0 };
        courses.forEach(course => {
            if (!course.duration || !course.days || !course.startMinutes) return;
            if (course.course_number.startsWith("CH EN") || course.course_number.startsWith("ENGIN")) {
                const courseLocations = (course.location || '').split(';').map(l => l.trim());
                courseLocations.forEach(loc => {
                    if (loc in mebRoomUsageMinutes) {
                        mebRoomUsageMinutes[loc] += course.duration * course.days.length;
                    }
                });
            }
            if (course.course_number.startsWith("CH EN")) {
                const courseNumStr = course.course_number.replace("CH EN", "").trim();
                const courseNum = parseInt(courseNumStr, 10);
                if (!isNaN(courseNum) && courseNum >= 1000 && courseNum <= 5999) {
                    const courseEndMinutes = course.startMinutes + course.duration;
                    const overlapStart = Math.max(course.startMinutes, primeTimeStart);
                    const overlapEnd = Math.min(courseEndMinutes, primeTimeEnd);
                    const primeMinutesForThisCourse = Math.max(0, overlapEnd - overlapStart);
                    for (const dayChar of course.days) {
                        const dayCode = dayMap[dayChar];
                        if (!dayCode) continue;
                        dailyMinutes[dayCode] += course.duration;
                        if (dayChar === 'M' || dayChar === 'W' || dayChar === 'F') {
                            mwfPrimeTimeMinutes += primeMinutesForThisCourse;
                        } else if (dayChar === 'T' || dayChar === 'R') {
                            trPrimeTimeMinutes += primeMinutesForThisCourse;
                        }
                    }
                }
            }
        });
        const totalWeeklyMinutes = Object.values(dailyMinutes).reduce((sum, mins) => sum + mins, 0);
        const totalPrimeTimeMinutes = mwfPrimeTimeMinutes + trPrimeTimeMinutes;
        const totalMinutesOutsidePrime = totalWeeklyMinutes - totalPrimeTimeMinutes;
        document.getElementById('metric-meb-1292').textContent = (mebRoomUsageMinutes["MEB 1292"] / 60).toFixed(1);
        document.getElementById('metric-meb-2550').textContent = (mebRoomUsageMinutes["MEB 2550"] / 60).toFixed(1);
        document.getElementById('metric-meb-3520').textContent = (mebRoomUsageMinutes["MEB 3520"] / 60).toFixed(1);
        const mwfPrimePercentage = (totalWeeklyMinutes > 0) ? (mwfPrimeTimeMinutes / totalWeeklyMinutes) * 100 : 0;
        const trPrimePercentage = (totalWeeklyMinutes > 0) ? (trPrimeTimeMinutes / totalWeeklyMinutes) * 100 : 0;
        const outsidePrimePercentage = (totalWeeklyMinutes > 0) ? (totalMinutesOutsidePrime / totalWeeklyMinutes) * 100 : 0;
        document.getElementById('metric-mwf-prime').textContent = mwfPrimePercentage.toFixed(0);
        document.getElementById('metric-tr-prime').textContent = trPrimePercentage.toFixed(0);
        document.getElementById('metric-outside-prime-hrs').textContent = (totalMinutesOutsidePrime / 60).toFixed(1);
        document.getElementById('metric-outside-prime-pct').textContent = outsidePrimePercentage.toFixed(0);
        document.getElementById('metric-mo-hrs').textContent = (dailyMinutes.Mo / 60).toFixed(1);
        document.getElementById('metric-tu-hrs').textContent = (dailyMinutes.Tu / 60).toFixed(1);
        document.getElementById('metric-we-hrs').textContent = (dailyMinutes.We / 60).toFixed(1);
        document.getElementById('metric-th-hrs').textContent = (dailyMinutes.Th / 60).toFixed(1);
        document.getElementById('metric-fr-hrs').textContent = (dailyMinutes.Fr / 60).toFixed(1);
        document.getElementById('metric-mo-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.Mo / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-tu-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.Tu / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-we-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.We / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-th-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.Th / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-fr-pct').textContent = (totalWeeklyMinutes > 0 ? (dailyMinutes.Fr / totalWeeklyMinutes) * 100 : 0).toFixed(0);
        document.getElementById('metric-total-hrs').textContent = (totalWeeklyMinutes / 60).toFixed(1);
    }
    
    function placeCourseOnCalendar(course, day, width = 100, left = 0) {
        const column = document.querySelector(`.day-content[data-day="${day}"]`);
        if (!column) return;
        
        const minutesSinceCalendarStart = course.startMinutes - (START_HOUR * 60);
        const topPosition = minutesSinceCalendarStart;
        const height = course.duration;
        if (!height || topPosition < 0) return;
        
        const eventDiv = document.createElement('div');
        eventDiv.className = 'class-event';
        
        eventDiv.style.top = `${topPosition}px`;
        eventDiv.style.height = `${height}px`;
        eventDiv.style.width = `calc(${width}% - 4px)`;
        eventDiv.style.left = `${left}%`;
        
        const color = courseColorMap.get(course.course_number) || '#a3c4f3';
        eventDiv.style.backgroundColor = color;
        eventDiv.style.borderColor = color;

        eventDiv.innerHTML = `
            <div class="event-title">${course.course_number}</div>
            <div class="event-tooltip">
                <strong>Course:</strong> ${course.course_number}<br>
                <strong>Instructor:</strong> ${course.instructors}<br>
                <strong>Time:</strong> ${course.time_of_day}<br>
                <strong>Location:</strong> ${course.location}<br>
                <strong>Type:</strong> ${course.type}<br>
                <strong>Duration:</strong> ${course.duration} min<br>
                ${course.notes ? `<strong>Notes:</strong> ${course.notes}<br>` : ''}
                ${course.anticipated_enrollment ? `<strong>Anticipated Enrollment:</strong> ${course.anticipated_enrollment}` : ''}
            </div>`;
            
        column.appendChild(eventDiv);
        
        eventDiv.addEventListener('mouseover', () => {
            const tooltip = eventDiv.querySelector('.event-tooltip');
            tooltip.classList.add('tooltip-visible');
            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            if (tooltipRect.right > viewportWidth) {
                tooltip.classList.add('tooltip-left');
            }
        });

        eventDiv.addEventListener('mouseout', () => {
            const tooltip = eventDiv.querySelector('.event-tooltip');
            tooltip.classList.remove('tooltip-visible');
            tooltip.classList.remove('tooltip-left');
        });
    }
});
