import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

// Load and process the data
let rawData = await d3.csv("./data/annual_hunting_season_environmental_conditions.csv");

// local
// let rawData = await d3.csv("/data/annual_hunting_season_environmental_conditions.csv");



// Get available features from data
const features = Object.keys(rawData[0]);

// Restore last selections from localStorage (fallback to defaults if absent or invalid)
const DEFAULTS = { x: 'year', y: 'leaf_drop_doy' };
const lsX = localStorage.getItem('xFeat');
const lsY = localStorage.getItem('yFeat');
const savedXFeat = (lsX && features.includes(lsX)) ? lsX : DEFAULTS.x;
const savedYFeat = (lsY && features.includes(lsY)) ? lsY : DEFAULTS.y;

// Function to create a dropdown for axis feature selection
function createDropdown(axis, defaultValue) {
    const dropdownContainer = d3.select("body")
        .insert("div", ":first-child")
        .style("margin-bottom", "10px");

    dropdownContainer.append("label")
        .text(`Select ${axis}-axis feature: `)
        .style("margin-right", "10px");

    const dropdown = dropdownContainer.append("select")
        .attr("class", `${axis}-axis-dropdown`)
        .on("change", function() { updateFeature(this.value, axis); });

    dropdown.selectAll("option")
        .data(features)
        .enter()
        .append("option")
        .text(d => d.replace(/_/g, " "))
        .attr("value", d => d)
        .property("selected", d => d === defaultValue);
}

// Create dropdowns for both axes using restored selections
createDropdown("y", savedYFeat);
createDropdown("x", savedXFeat);

// Configure which variables to plot (using restored selections)
let xFeat = savedXFeat;
let yFeat = savedYFeat;

// Function to update the plot when feature selection changes
function updateFeature(value, axis) {
    // Update the appropriate feature variable
    if (axis === 'x') {
        xFeat = value;
    } else {
        yFeat = value;
    }
    // Persist selection
    try {
        if (axis === 'x') {
            localStorage.setItem('xFeat', xFeat);
        } else {
            localStorage.setItem('yFeat', yFeat);
        }
    } catch (e) {
        // ignore storage errors
    }
    
    // Update processed data
    processedData = rawData.map(d => ({
        x: +d[xFeat],
        y: +d[yFeat],
        year: +d.year
    }));

    // Update scales
    const min = d3.min(processedData, d => axis === 'x' ? d.x : d.y);
    const max = d3.max(processedData, d => axis === 'x' ? d.x : d.y);
    const padding = 1;  // One unit padding
    
    if (axis === 'x') {
        // Update x scale with new domain
        xScale.domain([min - padding, max + padding]);
        originalXDomain = xScale.domain().map(d => d);

        // Update x-axis (disable transition for discrete 'year' ticks to prevent teleport)
        const buildXAxis = () => {
            const ax = d3.axisBottom(xScale);
            if (xFeat === 'year') {
                ax.tickFormat(d3.format('d')).tickValues(allYears);
            } else {
                ax.ticks(10);
            }
            return ax;
        };
        if (xFeat === 'year') {
            svg.select(".x-axis")
                .call(buildXAxis())
                .selectAll("text")
                .style("text-anchor", "middle");
        } else {
            svg.select(".x-axis")
                .transition()
                .duration(750)
                .call(buildXAxis())
                .selectAll("text")
                .style("text-anchor", "middle");
        }

        // Update x-axis label
        svg.select(".x-axis-label")
            .text(xFeat.replace(/_/g, " "));
    } else {
        // Update y scale with new domain
        yScale.domain([min - padding, max + padding]).nice();
        originalYDomain = yScale.domain().map(d => d);
        initialYTicks = yScale.ticks(10);

        // Update y-axis (disable transition for discrete 'year' ticks to prevent teleport)
        const buildYAxis = () => {
            const ay = d3.axisLeft(yScale).tickValues(initialYTicks);
            if (yFeat === 'year') {
                ay.tickFormat(d3.format('d'));
            }
            return ay;
        };
        if (yFeat === 'year') {
            svg.select(".y-axis")
                .call(buildYAxis())
                .selectAll(".tick text")
                .style("opacity", function(d) {
                    return (d === originalYDomain[0] || d === originalYDomain[1]) ? 0 : 1;
                });
        } else {
            // Pre-hide first/last tick labels for the new domain before transition
            const yAxisG = svg.select(".y-axis");
            const dom = yScale.domain();
            yAxisG.selectAll(".tick text")
                .style("opacity", function(d) {
                    return (Math.abs(d - dom[0]) < 1e-10 || Math.abs(d - dom[1]) < 1e-10) ? 0 : 1;
                });

            yAxisG
                .transition()
                .duration(750)
                .call(buildYAxis())
                .selectAll(".tick text")
                .style("opacity", function(d) {
                    return (d === originalYDomain[0] || d === originalYDomain[1]) ? 0 : 1;
                });
        }

        // Update y-axis label
        svg.select(".y-axis-label")
            .text(yFeat.replace(/_/g, " "));
    }

    // Update title with transition
    svg.select(".plot-title")
        .transition()
        .duration(750)
        .text(`${yFeat.replace(/_/g, " ")} vs ${xFeat.replace(/_/g, " ")}`);

    // Rebind updated data and update points with transition (DRY and robust)
    plotArea.selectAll(".point")
        .data(processedData, d => d.year)
        .transition()
        .duration(750)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .style("opacity", 0.7);

    interactionArea.selectAll(".interaction-point")
        .data(processedData, d => d.year)
        .transition()
        .duration(750)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y));
}

// Process the data
let processedData = rawData.map(d => ({
    x: +d[xFeat],
    y: +d[yFeat],
    year: +d.year  // We'll use this for tooltips
}));

// Set the dimensions and margins of the graph
const margin = {top: 40, right: 30, bottom: 60, left: 60};
const width = 800 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// Create the SVG container
const svg = d3.select("body")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Add a background rect to capture mouse events (placed behind the plot and interaction layers)
svg.append("rect")
    .attr("class", "background")
    .attr("width", width)
    .attr("height", height)
    .style("fill", "none")
    .style("pointer-events", "all");

// Define clip path
svg.append("defs")
    .append("clipPath")
    .attr("id", "plot-area")
    .append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("x", 0)
    .attr("y", 0);

// Create a group for the plot area that uses the clip path
const plotArea = svg.append("g")
    .attr("clip-path", "url(#plot-area)");

// Create a group for interactive elements (not clipped)
const interactionArea = svg.append("g");

// Create scales with better fit
const xMin = d3.min(processedData, d => d.x);
const xMax = d3.max(processedData, d => d.x);
const yMin = d3.min(processedData, d => d.y);
const yMax = d3.max(processedData, d => d.y);

// Calculate padding (one unit in each direction)
const xPadding = 1;  // One year padding
const yPadding = 1;  // One unit padding

// Store original domains for reset functionality
let originalXDomain = [xMin - xPadding, xMax + xPadding].map(d => d);
let originalYDomain; // will be set after yScale.nice() so it matches the rendered (nicified) domain

// (background rect moved earlier so it does not block interaction layers)

const xScale = d3.scaleLinear()
    .domain([xMin - xPadding, xMax + xPadding])  // Add one year padding on each side
    .range([0, width]);

const yScale = d3.scaleLinear()
    .domain([yMin - yPadding, yMax + yPadding])  // Add one unit padding on each side
    .nice() // This will round the domain to nice round numbers
    .range([height, 0]);

// After applying .nice(), store the actual rendered domain as the original domain
originalYDomain = yScale.domain().map(d => d);

// Store the original number of ticks that D3 generates for this scale and the exact tick values
const originalTickCount = yScale.ticks(10).length;
let initialYTicks = yScale.ticks(10);

// Add X axis with no comma formatting
const allYears = rawData.map(d => +d.year);  // Year values for discrete ticks when xFeat === 'year'
svg.append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${height})`)
    .call((() => {
        const ax = d3.axisBottom(xScale);
        if (xFeat === 'year') {
            ax.tickFormat(d3.format('d')).tickValues(allYears); // Use exact years as tick values
        } else {
            ax.ticks(10);
        }
        return ax;
    })())
    .selectAll("text")
    .style("text-anchor", "middle");

// Add Y axis using initial unzoomed tick values
svg.append("g")
    .attr("class", "axis y-axis")
    .call((() => {
        const ay = d3.axisLeft(yScale).tickValues(initialYTicks);
        if (yFeat === 'year') {
            ay.tickFormat(d3.format('d'));
        }
        return ay;
    })())
    .selectAll(".tick text")
    .style("opacity", function(d) {
        // Hide first and last ticks using original (nicified) domain
        return (d === originalYDomain[0] || d === originalYDomain[1]) ? 0 : 1;
    });

// Add X axis label
svg.append("text")
    .attr("class", "x-axis-label")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 10)
    .style("text-anchor", "middle")
    .text(xFeat.replace(/_/g, " "));

// Add Y axis label
svg.append("text")
    .attr("class", "y-axis-label")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 20)
    .attr("x", -(height / 2))
    .style("text-anchor", "middle")
    .text(yFeat.replace(/_/g, " "));

// Add title
svg.append("text")
    .attr("class", "plot-title")  // Add a class for reliable selection
    .attr("x", width / 2)
    .attr("y", -margin.top / 2)
    .style("text-anchor", "middle")
    .style("font-size", "16px")
    .text(`${yFeat.replace(/_/g, " ")} vs ${xFeat.replace(/_/g, " ")}`);

// Create a tooltip div
const tooltip = d3.select("body").append("div")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "1px")
    .style("border-radius", "5px")
    .style("padding", "10px");

// Create a rect for the drag selection
svg.append("rect")
    .attr("class", "selection")
    .style("visibility", "hidden")
    .style("fill", "#69b3a2")
    .style("opacity", 0.3)
    .style("stroke", "#69b3a2")
    .style("stroke-dasharray", "4px")
    .style("stroke-width", "2px");

// Variables to store drag start position
let dragStart = { x: 0, y: 0 };

// Create drag behavior
const drag = d3.drag()
    .on("start", function(event) {
        dragStart.x = event.x;
        dragStart.y = event.y;
        d3.select(".selection")
            .style("visibility", "visible")
            .attr("x", dragStart.x)
            .attr("y", dragStart.y)
            .attr("width", 0)
            .attr("height", 0);
    })
    .on("drag", function(event) {
        const x = Math.min(dragStart.x, event.x);
        const y = Math.min(dragStart.y, event.y);
        const width = Math.abs(event.x - dragStart.x);
        const height = Math.abs(event.y - dragStart.y);

        d3.select(".selection")
            .attr("x", x)
            .attr("y", y)
            .attr("width", width)
            .attr("height", height);
    })
    .on("end", function(event) {
        // Get the coordinates of the selection box
        const selection = d3.select(".selection");
        const x1 = +selection.attr("x");
        const x2 = x1 + +selection.attr("width");
        const y1 = +selection.attr("y");
        const y2 = y1 + +selection.attr("height");

        // Calculate the width and height of selection
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        if (width <= 5 && height <= 5) {
            // Single click - only reset if the view is currently zoomed
            const eps = 1e-10;
            const curX = xScale.domain();
            const curY = yScale.domain();
            const atOriginalX = Math.abs(curX[0] - originalXDomain[0]) < eps && Math.abs(curX[1] - originalXDomain[1]) < eps;
            const atOriginalY = Math.abs(curY[0] - originalYDomain[0]) < eps && Math.abs(curY[1] - originalYDomain[1]) < eps;

            // If already at original (not zoomed), do nothing on click
            if (atOriginalX && atOriginalY) {
                // Hide selection box and exit without changing axes or animating
                selection.style("visibility", "hidden");
                return;
            }

            // Otherwise, reset domains to original and animate or update immediately below
            xScale.domain(originalXDomain);
            yScale.domain(originalYDomain);

            if (!atOriginalX || !atOriginalY) {
                // Use transitions to animate back to original view
                // Reset x-axis; avoid transition for 'year' to prevent teleport
                const buildXAxisReset = () => {
                    const ax = d3.axisBottom(xScale);
                    if (xFeat === 'year') {
                        ax.tickFormat(d3.format('d')).tickValues(allYears);
                    } else {
                        ax.ticks(10);
                    }
                    return ax;
                };
                if (xFeat === 'year') {
                    svg.select(".x-axis")
                        .call(buildXAxisReset())
                        .selectAll("text")
                        .style("text-anchor", "middle");
                } else {
                    svg.select(".x-axis")
                        .transition()
                        .duration(750)
                        .call(buildXAxisReset())
                        .selectAll("text")
                        .style("text-anchor", "middle");
                }

                // Reset y-axis; avoid transition for 'year' to prevent teleport
                const buildYAxisReset = () => {
                    const ay = d3.axisLeft(yScale).tickValues(initialYTicks);
                    if (yFeat === 'year') {
                        ay.tickFormat(d3.format('d'));
                    }
                    return ay;
                };
                if (yFeat === 'year') {
                    const ySel = svg.select(".y-axis").call(buildYAxisReset());
                    // Immediately update tick opacity
                    ySel.selectAll(".tick text")
                        .style("opacity", function(d) {
                            const domain = yScale.domain();
                            return (d === domain[0] || d === domain[1]) ? 0 : 1;
                        });
                } else {
                    // Pre-hide first/last tick labels for the new domain before transition
                    const yAxisG = svg.select(".y-axis");
                    const dom = yScale.domain();
                    yAxisG.selectAll(".tick text")
                        .style("opacity", function(d) {
                            return (Math.abs(d - dom[0]) < 1e-10 || Math.abs(d - dom[1]) < 1e-10) ? 0 : 1;
                        });

                    yAxisG
                        .transition()
                        .duration(750)
                        .call(buildYAxisReset())
                        .on("end", function() {
                            // After transition, reset opacity for all tick texts
                            d3.select(this)
                                .selectAll(".tick text")
                                .style("opacity", function(d) {
                                    const domain = yScale.domain();
                                    return (d === domain[0] || d === domain[1]) ? 0 : 1;
                                });
                        });
                }

                // Animate points as before
                plotArea.selectAll(".point")
                    .transition()
                    .duration(750)
                    .attr("cx", d => xScale(d.x))
                    .attr("cy", d => yScale(d.y))
                    .attr("r", 5)
                    .style("opacity", 0.7)
                    .style("pointer-events", "none");

                interactionArea.selectAll(".interaction-point")
                    .transition()
                    .duration(750)
                    .attr("cx", d => xScale(d.x))
                    .attr("cy", d => yScale(d.y))
                    .attr("r", 8)
                    .style("pointer-events", "all");
            } else {
                // Already at original view: set axes and points immediately without animation
                svg.select(".x-axis")
                    .call((() => {
                        const ax = d3.axisBottom(xScale);
                        if (xFeat === 'year') {
                            ax.tickFormat(d3.format('d')).tickValues(allYears);
                        } else {
                            ax.ticks(10);
                        }
                        return ax;
                    })())
                    .selectAll("text")
                    .style("text-anchor", "middle");

                svg.select(".y-axis")
                    .call((() => {
                        const ay = d3.axisLeft(yScale).tickValues(initialYTicks);
                        if (yFeat === 'year') {
                            ay.tickFormat(d3.format('d'));
                        }
                        return ay;
                    })());

                svg.select(".y-axis")
                    .selectAll(".tick text")
                    .style("opacity", function(d) {
                        const domain = yScale.domain();
                        return (d === domain[0] || d === domain[1]) ? 0 : 1;
                    });

                plotArea.selectAll(".point")
                    .attr("cx", d => xScale(d.x))
                    .attr("cy", d => yScale(d.y))
                    .attr("r", 5)
                    .style("opacity", 0.7)
                    .style("pointer-events", "none");

                interactionArea.selectAll(".interaction-point")
                    .attr("cx", d => xScale(d.x))
                    .attr("cy", d => yScale(d.y))
                    .attr("r", 8)
                    .style("pointer-events", "all");
            }
        } else {
            // Drag selection - zoom to selection area
            const newXDomain = [xScale.invert(x1), xScale.invert(x2)];
            const newYDomain = [yScale.invert(y2), yScale.invert(y1)]; // Reverse Y because SVG coordinates
            xScale.domain(newXDomain);
            yScale.domain(newYDomain).nice();  // Make the domain nice for better tick values

            // For zoom, only show years in view
            const yearsInView = processedData
                .filter(d => d.x >= newXDomain[0] && d.x <= newXDomain[1])
                .map(d => d.x);

            // Update X axis for zoom; avoid transition for 'year' to prevent teleport
            const buildXAxisZoom = () => {
                const ax = d3.axisBottom(xScale);
                if (xFeat === 'year') {
                    ax.tickFormat(d3.format('d')).tickValues(yearsInView);
                } else {
                    ax.ticks(10);
                }
                return ax;
            };
            if (xFeat === 'year') {
                svg.select(".x-axis")
                    .call(buildXAxisZoom())
                    .selectAll("text")
                    .style("text-anchor", "middle");
            } else {
                svg.select(".x-axis")
                    .transition()
                    .duration(750)
                    .call(buildXAxisZoom())
                    .selectAll("text")  // Select all tick labels
                    .style("text-anchor", "middle");
            }
        }

        // Update Y axis; avoid transition for 'year' to prevent teleport
        const buildYAxisZoom = () => {
            const ay = d3.axisLeft(yScale).ticks(10);
            if (yFeat === 'year') {
                ay.tickFormat(d3.format('d'));
            }
            return ay;
        };
        if (yFeat === 'year') {
            const ySel = svg.select(".y-axis").call(buildYAxisZoom());
            // Immediately update tick visibility
            ySel.selectAll(".tick text")
                .style("opacity", function(d) {
                    const domain = yScale.domain();
                    return (Math.abs(d - domain[0]) < 1e-10 || Math.abs(d - domain[1]) < 1e-10) ? 0 : 1;
                });
        } else {
            // Pre-hide first/last tick labels for the new domain before transition
            const yAxisG = svg.select(".y-axis");
            const dom = yScale.domain();
            yAxisG.selectAll(".tick text")
                .style("opacity", function(d) {
                    return (Math.abs(d - dom[0]) < 1e-10 || Math.abs(d - dom[1]) < 1e-10) ? 0 : 1;
                });

            yAxisG
                .transition()
                .duration(750)
                .call(buildYAxisZoom())
                .on("end", function() {
                    // After transition completes, update tick visibility
                    d3.select(this)
                        .selectAll(".tick text")
                        .style("opacity", function(d) {
                            const domain = yScale.domain();
                            return (Math.abs(d - domain[0]) < 1e-10 || Math.abs(d - domain[1]) < 1e-10) ? 0 : 1;
                        });
                });
        }

        // Update both sets of points with transition
        plotArea.selectAll(".point")
            .transition()
            .duration(750)
            .attr("cx", d => xScale(d.x))
            .attr("cy", d => yScale(d.y))
            .style("opacity", 0.7);
            
        interactionArea.selectAll(".interaction-point")
            .transition()
            .duration(750)
            .attr("cx", d => xScale(d.x))
            .attr("cy", d => yScale(d.y));

        // Hide the selection box
        selection.style("visibility", "hidden");
    });

// Add the drag behavior to the background rect
svg.select(".background").call(drag);

// Add the visible scatter points (clipped)
plotArea.selectAll(".point")
    .data(processedData)
    .enter()
    .append("circle")
    .attr("class", "point")
    .attr("data-year", d => d.year)
    .attr("cx", d => xScale(d.x))
    .attr("cy", d => yScale(d.y))
    .attr("r", 5)
    .style("fill", "steelblue")
    .style("opacity", 0.7);

// Add invisible interactive circles (not clipped, used for hover detection)
interactionArea.selectAll(".interaction-point")
    .data(processedData)
    .enter()
    .append("circle")
    .attr("class", "interaction-point")
    .attr("data-year", d => d.year)
    .attr("cx", d => xScale(d.x))
    .attr("cy", d => yScale(d.y))
    .attr("r", 8) // larger target for easier hovering
    .style("fill", "transparent")
    .style("pointer-events", "all")
    // Add hover effects (single set of handlers)
    .on("mouseover", function(event, d) {
        // Show tooltip for this point; do not change marker size
        const sel = plotArea.selectAll(".point").filter(pd => pd.year === d.year);
        // ensure visible point is on top for clarity (no size change)
        sel.raise();
        sel.style("opacity", 1);
        tooltip
            .style("visibility", "visible")
            .html(`Year: ${d.year}<br/>${xFeat}: ${d.x}<br/>${yFeat}: ${d.y}`);
    })
    .on("mousemove", function(event) {
        tooltip
            .style("top", (event.pageY - 10) + "px")
            .style("left", (event.pageX + 10) + "px");
    })
    .on("mouseout", function(event, d) {
        const sel = plotArea.selectAll(".point").filter(pd => pd.year === d.year);
        // restore opacity only, leave radius unchanged
        sel.style("opacity", 0.7);
        tooltip.style("visibility", "hidden");
    });
