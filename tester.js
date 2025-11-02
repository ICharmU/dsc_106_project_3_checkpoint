import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
let x = document.createElement("h3");
x.innerText = "asdf";
document.body.appendChild(x);

let rawData = await d3.csv("/data/annual_hunting_season_environmental_conditions.csv");

let data = {};
const columns = Object.keys(rawData[0]);

columns.forEach(column => {
    data[column] = rawData.map(row => row[column]);
});

// Create SVG
let currFeat = "leaf_drop_doy"
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

// Process data for the visualization
let processedData = data.year.map((year, i) => ({
    year: +year,
    [currFeat]: +data[currFeat][i]  // Convert to number and use dynamic key name
}));

// Create scales
const xScale = d3.scaleBand()
    .domain(processedData.map(d => d.year))
    .range([0, width])
    .padding(0.1);

const yScale = d3.scaleLinear()
    .domain([0, d3.max(processedData, d => d[currFeat])])
    .range([height, 0]);

// Create and add the bars
svg.selectAll("rect")
    .data(processedData)
    .enter()
    .append("rect")
    .attr("x", d => xScale(d.year))
    .attr("y", d => yScale(d[currFeat]))
    .attr("width", xScale.bandwidth())
    .attr("height", d => height - yScale(d[currFeat]))
    .attr("fill", "steelblue");

// Add the X axis
svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-45)");

// Add the Y axis
svg.append("g")
    .call(d3.axisLeft(yScale));

// Add X axis label
svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 10)
    .style("text-anchor", "middle")
    .text("Year");

// Add Y axis label
svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 20)
    .attr("x", -(height / 2))
    .style("text-anchor", "middle")
    .text(`${currFeat}`);

// Add title
svg.append("text")
    .attr("x", width / 2)
    .attr("y", -margin.top / 2)
    .style("text-anchor", "middle")
    .style("font-size", "16px")
    .text(`${currFeat} by Year`);