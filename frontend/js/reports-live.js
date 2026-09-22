(function () {

    "use strict";


    /* =========================================================
       STATE
    ========================================================= */

    let reportData =
        null;

    let allCategories =
        [];

    let firstLoad =
        true;

    let toastTimer =
        null;


    /* =========================================================
       DOM
    ========================================================= */

    function get(
        id
    ) {

        return document.getElementById(
            id
        );
    }


    /* =========================================================
       API
    ========================================================= */

    async function api(
        url
    ) {

        const response =
            await fetch(
                url,
                {
                    credentials:
                        "include",

                    cache:
                        "no-store"
                }
            );


        const data =
            await response
                .json()
                .catch(
                    () => ({})
                );


        if (
            response.status ===
            401
        ) {

            location.replace(
                "/login.html"
            );


            throw new Error(
                "Login required."
            );
        }


        if (
            response.status ===
            403
        ) {

            location.replace(
                "/dashboard.html"
            );


            throw new Error(
                "Administrator access required."
            );
        }


        if (
            !response.ok
        ) {

            throw new Error(
                data.message ||
                "Unable to load report."
            );
        }


        return data;
    }


    /* =========================================================
       TEXT
    ========================================================= */

    function escapeHtml(
        value
    ) {

        return String(
            value ?? ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    }


    function initials(
        value
    ) {

        return String(
            value ||
            "RD"
        )
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(
                word =>
                    word[0]
            )
            .join("")
            .toUpperCase();
    }


    function label(
        value
    ) {

        return String(
            value ||
            ""
        )
            .replaceAll(
                "_",
                " "
            )
            .toLowerCase()
            .replace(
                /\b\w/g,
                char =>
                    char.toUpperCase()
            );
    }


    function formatDuration(
        minutes
    ) {

        const value =
            Math.round(
                Number(
                    minutes
                ) ||
                0
            );


        if (
            value <= 0
        ) {

            return "—";
        }


        if (
            value < 60
        ) {

            return `${value}m`;
        }


        const hours =
            Math.floor(
                value /
                60
            );


        const mins =
            value %
            60;


        if (
            hours < 24
        ) {

            return `${hours}h ${mins}m`;
        }


        const days =
            Math.floor(
                hours /
                24
            );


        return `${days}d ${hours % 24}h`;
    }


    /* =========================================================
       LOAD
    ========================================================= */

    async function loadReport(
        showMessage = false
    ) {

        const period =
            Number(
                get(
                    "periodFilter"
                )?.value
            ) ||
            30;


        const departmentId =
            get(
                "departmentFilter"
            )?.value ||
            "";


        const categoryId =
            get(
                "categoryFilter"
            )?.value ||
            "";


        const params =
            new URLSearchParams({

                period:
                    String(
                        period
                    )

            });


        if (
            departmentId
        ) {

            params.set(
                "departmentId",
                departmentId
            );
        }


        if (
            categoryId
        ) {

            params.set(
                "categoryId",
                categoryId
            );
        }


        const data =
            await api(
                `/api/reports/overview?${params}`
            );


        reportData =
            data;


        allCategories =
            data.options
                ?.categories ||
            [];


        if (
            firstLoad
        ) {

            populateDepartmentFilter(
                data.options
                    ?.departments ||
                []
            );


            populateCategoryFilter(
                allCategories
            );


            firstLoad =
                false;

        } else {

            /*
                Department may have changed.
                Only show matching categories.
            */

            populateCategoryFilter(
                allCategories,
                true
            );
        }


        renderEverything();


        if (
            showMessage
        ) {

            showToast(
                "Report refreshed."
            );
        }


        console.log(
            "✅ ResolveDesk live report:",
            reportData
        );
    }


    /* =========================================================
       FILTER OPTIONS
    ========================================================= */

    function populateDepartmentFilter(
        departments
    ) {

        const select =
            get(
                "departmentFilter"
            );


        if (!select) {
            return;
        }


        const current =
            select.value;


        select.innerHTML = `
            <option value="">
                All Departments
            </option>

            ${
                departments
                    .map(
                        department => `

                            <option
                                value="${escapeHtml(
                                    department.id
                                )}"
                            >
                                ${escapeHtml(
                                    department.name
                                )}
                            </option>
                        `
                    )
                    .join("")
            }
        `;


        if (
            [
                ...select.options
            ].some(
                option =>
                    option.value ===
                    current
            )
        ) {

            select.value =
                current;
        }
    }


    function populateCategoryFilter(
        categories,
        preserve = false
    ) {

        const select =
            get(
                "categoryFilter"
            );


        if (!select) {
            return;
        }


        const current =
            preserve
                ? select.value
                : "";


        const departmentId =
            get(
                "departmentFilter"
            )?.value ||
            "";


        const visible =
            departmentId
                ? categories.filter(
                    category =>
                        String(
                            category.departmentId
                        ) ===
                        String(
                            departmentId
                        )
                )
                : categories;


        select.innerHTML = `
            <option value="">
                All Categories
            </option>

            ${
                visible
                    .map(
                        category => `

                            <option
                                value="${escapeHtml(
                                    category.id
                                )}"
                            >
                                ${escapeHtml(
                                    category.name
                                )}
                            </option>
                        `
                    )
                    .join("")
            }
        `;


        if (
            visible.some(
                category =>
                    String(
                        category.id
                    ) ===
                    String(
                        current
                    )
            )
        ) {

            select.value =
                current;
        }
    }


    /* =========================================================
       KPI
    ========================================================= */

    function renderStats() {

        const stats =
            reportData?.stats ||
            {};


        setText(
            "totalTicketStat",
            stats.totalTickets ??
            0
        );


        setText(
            "resolvedStat",
            stats.resolvedTickets ??
            0
        );


        setText(
            "resolutionStat",
            formatDuration(
                stats.averageResolutionMinutes
            )
        );


        setText(
            "slaStat",
            `${
                stats.slaCompliance ??
                100
            }%`
        );
    }


    function setText(
        id,
        value
    ) {

        const element =
            get(
                id
            );


        if (
            element
        ) {

            element.textContent =
                value;
        }
    }


    /* =========================================================
       TECHNICIAN TABLE
    ========================================================= */

    function renderTechnicians() {

        const rows =
            get(
                "technicianRows"
            );


        if (!rows) {
            return;
        }


        const search =
            String(
                get(
                    "topSearch"
                )?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        const technicians =
            (
                reportData
                    ?.technicians ||
                []
            )
                .filter(
                    technician => {

                        if (!search) {

                            return true;
                        }


                        return [
                            technician.name,
                            technician.specialty
                        ]
                            .join(
                                " "
                            )
                            .toLowerCase()
                            .includes(
                                search
                            );
                    }
                );


        if (
            technicians.length ===
            0
        ) {

            rows.innerHTML = `
                <tr>

                    <td
                        colspan="6"
                        style="
                            text-align:center;
                            padding:28px;
                            color:#716579;
                        "
                    >
                        No technician activity
                        for this report period.
                    </td>

                </tr>
            `;


            return;
        }


        rows.innerHTML =
            technicians
                .map(
                    technician => {

                        const performance =
                            technician.sla >= 95
                                ? "Excellent"
                                : technician.sla >= 90
                                    ? "Healthy"
                                    : "Needs Attention";


                        return `

                            <tr>

                                <td>

                                    <div class="tech-cell">

                                        <div class="tech-avatar">
                                            ${escapeHtml(
                                                initials(
                                                    technician.name
                                                )
                                            )}
                                        </div>

                                        <div>

                                            <strong>
                                                ${escapeHtml(
                                                    technician.name
                                                )}
                                            </strong>

                                            <span>
                                                ${escapeHtml(
                                                    technician.specialty
                                                )}
                                            </span>

                                        </div>

                                    </div>

                                </td>


                                <td>
                                    ${technician.resolved}
                                </td>


                                <td>
                                    ${technician.active}
                                </td>


                                <td>
                                    ${escapeHtml(
                                        formatDuration(
                                            technician.averageMinutes
                                        )
                                    )}
                                </td>


                                <td>
                                    ${technician.sla}%
                                </td>


                                <td>

                                    <span
                                        class="
                                            performance
                                            ${
                                                technician.sla < 90
                                                    ? "warning"
                                                    : ""
                                            }
                                        "
                                    >

                                        <span
                                            class="performance-dot"
                                        ></span>

                                        ${performance}

                                    </span>

                                </td>

                            </tr>
                        `;
                    }
                )
                .join("");
    }


    /* =========================================================
       CATEGORY DONUT
    ========================================================= */

    function renderCategories() {

        const categories =
            reportData
                ?.categories ||
            [];


        const total =
            categories.reduce(
                (
                    sum,
                    item
                ) =>
                    sum +
                    Number(
                        item.total ||
                        0
                    ),
                0
            );


        const donut =
            document.querySelector(
                ".donut"
            );


        const center =
            document.querySelector(
                ".donut-center strong"
            );


        const legend =
            document.querySelector(
                ".donut-legend"
            );


        if (
            center
        ) {

            center.textContent =
                total;
        }


        const colors =
            [
                "var(--topaz)",
                "var(--amethyst)",
                "var(--rose)",
                "var(--jewel)",
                "#a77ac2",
                "#91b7c6"
            ];


        let start =
            0;


        const segments =
            categories
                .slice(
                    0,
                    6
                )
                .map(
                    (
                        category,
                        index
                    ) => {

                        const value =
                            total
                                ? (
                                    category.total /
                                    total *
                                    100
                                )
                                : 0;


                        const end =
                            start +
                            value;


                        const segment =
                            `${
                                colors[
                                    index %
                                    colors.length
                                ]
                            } ${
                                start
                            }% ${
                                end
                            }%`;


                        start =
                            end;


                        return segment;
                    }
                );


        if (
            donut
        ) {

            donut.style.background =
                total
                    ? `conic-gradient(${
                        segments.join(
                            ","
                        )
                    })`
                    : "rgba(255,255,255,.05)";
        }


        if (
            legend
        ) {

            if (
                categories.length ===
                0
            ) {

                legend.innerHTML = `
                    <div class="donut-row">
                        No category data.
                    </div>
                `;

                return;
            }


            legend.innerHTML =
                categories
                    .slice(
                        0,
                        6
                    )
                    .map(
                        (
                            category,
                            index
                        ) => {

                            const value =
                                total
                                    ? Math.round(
                                        category.total /
                                        total *
                                        100
                                    )
                                    : 0;


                            return `

                                <div class="donut-row">

                                    <div class="donut-label">

                                        <i
                                            style="
                                                background:
                                                    ${
                                                        colors[
                                                            index %
                                                            colors.length
                                                        ]
                                                    };
                                            "
                                        ></i>

                                        ${escapeHtml(
                                            category.name
                                        )}

                                    </div>

                                    <strong>
                                        ${value}%
                                    </strong>

                                </div>
                            `;
                        }
                    )
                    .join("");
        }
    }


    /* =========================================================
       SLA PANEL
    ========================================================= */

    function renderSla() {

        const panel =
            findPanel(
                "SLA Compliance"
            );


        if (!panel) {
            return;
        }


        const stats =
            reportData
                ?.stats ||
            {};


        const big =
            panel.querySelector(
                ".sla-big strong"
            );


        const track =
            panel.querySelector(
                ".sla-track span"
            );


        if (
            big
        ) {

            big.textContent =
                `${
                    stats.slaCompliance ??
                    100
                }%`;
        }


        if (
            track
        ) {

            track.style.width =
                `${
                    stats.slaCompliance ??
                    100
                }%`;
        }


        const values =
            panel.querySelectorAll(
                ".sla-item strong"
            );


        if (
            values[0]
        ) {

            values[0]
                .textContent =
                    stats.withinSla ??
                    0;
        }


        if (
            values[1]
        ) {

            values[1]
                .textContent =
                    stats.breached ??
                    0;
        }


        if (
            values[2]
        ) {

            values[2]
                .textContent =
                    `${
                        stats.responseSla ??
                        100
                    }%`;
        }


        if (
            values[3]
        ) {

            values[3]
                .textContent =
                    `${
                        stats.resolutionSla ??
                        100
                    }%`;
        }
    }


    /* =========================================================
       PRIORITY
    ========================================================= */

    function renderPriorities() {

        const list =
            document.querySelector(
                ".priority-list"
            );


        if (!list) {
            return;
        }


        const priorities =
            [
                "CRITICAL",
                "HIGH",
                "MEDIUM",
                "LOW"
            ];


        const map =
            new Map(
                (
                    reportData
                        ?.priorities ||
                    []
                )
                    .map(
                        item => [

                            String(
                                item.priority
                            ).toUpperCase(),

                            Number(
                                item.total
                            ) ||
                            0

                        ]
                    )
            );


        const max =
            Math.max(
                1,
                ...priorities.map(
                    priority =>
                        map.get(
                            priority
                        ) ||
                        0
                )
            );


        list.innerHTML =
            priorities
                .map(
                    priority => {

                        const total =
                            map.get(
                                priority
                            ) ||
                            0;


                        const width =
                            total /
                            max *
                            100;


                        return `

                            <div class="priority-row">

                                <div class="priority-head">

                                    <div class="priority-name">

                                        <span
                                            class="
                                                priority-dot
                                                ${priority.toLowerCase()}
                                            "
                                        ></span>

                                        <span>
                                            ${label(
                                                priority
                                            )}
                                        </span>

                                    </div>

                                    <strong>
                                        ${total}
                                    </strong>

                                </div>


                                <div class="bar">

                                    <span
                                        style="
                                            width:${width}%;
                                        "
                                    ></span>

                                </div>

                            </div>
                        `;
                    }
                )
                .join("");
    }


    /* =========================================================
       TREND
    ========================================================= */

    function renderTrend() {

        const svg =
            document.querySelector(
                ".chart svg"
            );


        if (!svg) {
            return;
        }


        const compressed =
            compressTrend(
                reportData
                    ?.trend ||
                []
            );


        if (
            compressed.length ===
            0
        ) {

            return;
        }


        const created =
            compressed.map(
                item =>
                    item.created
            );


        const resolved =
            compressed.map(
                item =>
                    item.resolved
            );


        const max =
            Math.max(
                1,
                ...created,
                ...resolved
            );


        const createdLine =
            chartPath(
                created,
                max
            );


        const resolvedLine =
            chartPath(
                resolved,
                max
            );


        const paths =
            svg.querySelectorAll(
                "path"
            );


        if (
            paths.length >=
            4
        ) {

            paths[0]
                .setAttribute(
                    "d",
                    `${createdLine} L800,300 L0,300 Z`
                );


            paths[1]
                .setAttribute(
                    "d",
                    createdLine
                );


            paths[2]
                .setAttribute(
                    "d",
                    `${resolvedLine} L800,300 L0,300 Z`
                );


            paths[3]
                .setAttribute(
                    "d",
                    resolvedLine
                );
        }


        const labels =
            document.querySelector(
                ".chart-labels"
            );


        if (
            labels
        ) {

            labels.innerHTML =
                compressed
                    .map(
                        item => `
                            <span>
                                ${escapeHtml(
                                    item.label
                                )}
                            </span>
                        `
                    )
                    .join("");
        }
    }


    function compressTrend(
        source
    ) {

        if (
            source.length ===
            0
        ) {

            return [];
        }


        const targetBuckets =
            8;


        const chunk =
            Math.max(
                1,
                Math.ceil(
                    source.length /
                    targetBuckets
                )
            );


        const result =
            [];


        for (
            let index = 0;
            index < source.length;
            index += chunk
        ) {

            const items =
                source.slice(
                    index,
                    index +
                    chunk
                );


            const created =
                items.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Number(
                            item.created ||
                            0
                        ),
                    0
                );


            const resolved =
                items.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Number(
                            item.resolved ||
                            0
                        ),
                    0
                );


            const date =
                new Date(
                    items[
                        items.length -
                        1
                    ].date
                );


            result.push({

                created,

                resolved,

                label:
                    date.toLocaleDateString(
                        "en-MY",
                        source.length > 90
                            ? {
                                month:
                                    "short"
                            }
                            : {
                                day:
                                    "2-digit",
                                month:
                                    "short"
                            }
                    )

            });
        }


        return result;
    }


    function chartPath(
        values,
        max
    ) {

        if (
            values.length ===
            1
        ) {

            values =
                [
                    values[0],
                    values[0]
                ];
        }


        return values
            .map(
                (
                    value,
                    index
                ) => {

                    const x =
                        index *
                        (
                            800 /
                            (
                                values.length -
                                1
                            )
                        );


                    const y =
                        260 -
                        (
                            value /
                            max *
                            205
                        );


                    return `${
                        index === 0
                            ? "M"
                            : "L"
                    }${x.toFixed(
                        1
                    )},${y.toFixed(
                        1
                    )}`;
                }
            )
            .join(
                " "
            );
    }


    /* =========================================================
       SUMMARY
    ========================================================= */

    function renderSummary() {

        const cards =
            document.querySelectorAll(
                ".summary-grid .panel"
            );


        const summary =
            reportData
                ?.summary ||
            {};


        if (
            cards[0]
        ) {

            const number =
                cards[0]
                    .querySelector(
                        ".summary-number"
                    );


            if (
                number
            ) {

                number.textContent =
                    formatDuration(
                        summary.firstResponseMinutes
                    );
            }


            const change =
                cards[0]
                    .querySelector(
                        ".summary-change"
                    );


            if (
                change
            ) {

                change.textContent =
                    "Live period average";
            }
        }


        if (
            cards[1]
        ) {

            const number =
                cards[1]
                    .querySelector(
                        ".summary-number"
                    );


            if (
                number
            ) {

                number.textContent =
                    `${
                        Number(
                            summary.reopenRate ||
                            0
                        ).toFixed(
                            1
                        )
                    }%`;
            }


            const change =
                cards[1]
                    .querySelector(
                        ".summary-change"
                    );


            if (
                change
            ) {

                change.textContent =
                    "Based on ticket history";
            }
        }


        /*
            We do not invent Knowledge Base
            deflection percentage without
            real tracking data.
        */

        if (
            cards[2]
        ) {

            const number =
                cards[2]
                    .querySelector(
                        ".summary-number"
                    );


            if (
                number
            ) {

                number.textContent =
                    "—";
            }


            const change =
                cards[2]
                    .querySelector(
                        ".summary-change"
                    );


            if (
                change
            ) {

                change.textContent =
                    "KB analytics not tracked yet";
            }
        }
    }


    /* =========================================================
       FIND PANEL
    ========================================================= */

    function findPanel(
        title
    ) {

        return [
            ...document.querySelectorAll(
                ".panel"
            )
        ].find(
            panel => {

                const strong =
                    panel.querySelector(
                        ".panel-title strong"
                    );


                return (
                    strong
                        ?.textContent
                        .trim() ===
                    title
                );
            }
        );
    }


    /* =========================================================
       CSV
    ========================================================= */

    function exportCsv() {

        if (
            !reportData
        ) {

            return;
        }


        const periodText =
            get(
                "periodFilter"
            )
                ?.selectedOptions[
                    0
                ]
                ?.textContent
                ?.trim() ||
            "Report";


        const departmentText =
            get(
                "departmentFilter"
            )
                ?.selectedOptions[
                    0
                ]
                ?.textContent
                ?.trim() ||
            "All Departments";


        const categoryText =
            get(
                "categoryFilter"
            )
                ?.selectedOptions[
                    0
                ]
                ?.textContent
                ?.trim() ||
            "All Categories";


        const stats =
            reportData.stats;


        const rows = [

            [
                "ResolveDesk Report"
            ],

            [
                "Period",
                periodText
            ],

            [
                "Department",
                departmentText
            ],

            [
                "Category",
                categoryText
            ],

            [],

            [
                "Metric",
                "Value"
            ],

            [
                "Total Tickets",
                stats.totalTickets
            ],

            [
                "Resolved Tickets",
                stats.resolvedTickets
            ],

            [
                "Active Tickets",
                stats.activeTickets
            ],

            [
                "Average Resolution",
                formatDuration(
                    stats.averageResolutionMinutes
                )
            ],

            [
                "Average First Response",
                formatDuration(
                    stats.averageFirstResponseMinutes
                )
            ],

            [
                "SLA Compliance",
                `${stats.slaCompliance}%`
            ],

            [
                "Response SLA",
                `${stats.responseSla}%`
            ],

            [
                "Resolution SLA",
                `${stats.resolutionSla}%`
            ],

            [
                "Reopen Rate",
                `${Number(
                    stats.reopenRate ||
                    0
                ).toFixed(
                    1
                )}%`
            ],

            [],

            [
                "Technician",
                "Specialty",
                "Resolved",
                "Active",
                "Average Resolution",
                "SLA"
            ],

            ...(
                reportData
                    .technicians ||
                []
            ).map(
                technician => [

                    technician.name,

                    technician.specialty,

                    technician.resolved,

                    technician.active,

                    formatDuration(
                        technician.averageMinutes
                    ),

                    `${technician.sla}%`

                ]
            ),

            [],

            [
                "Category",
                "Tickets"
            ],

            ...(
                reportData
                    .categories ||
                []
            ).map(
                category => [

                    category.name,

                    category.total

                ]
            ),

            [],

            [
                "Priority",
                "Tickets"
            ],

            ...(
                reportData
                    .priorities ||
                []
            ).map(
                priority => [

                    priority.priority,

                    priority.total

                ]
            )

        ];


        const csv =
            rows
                .map(
                    row =>
                        row
                            .map(
                                csvCell
                            )
                            .join(
                                ","
                            )
                )
                .join(
                    "\n"
                );


        const blob =
            new Blob(
                [
                    "\uFEFF",
                    csv
                ],
                {
                    type:
                        "text/csv;charset=utf-8;"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            url;


        link.download =
            `resolvedesk-report-${
                new Date()
                    .toISOString()
                    .slice(
                        0,
                        10
                    )
            }.csv`;


        document.body.appendChild(
            link
        );


        link.click();

        link.remove();

        URL.revokeObjectURL(
            url
        );


        showToast(
            "Live report exported as CSV."
        );
    }


    function csvCell(
        value
    ) {

        return `"${String(
            value ??
            ""
        ).replaceAll(
            '"',
            '""'
        )}"`;
    }


    /* =========================================================
       RENDER ALL
    ========================================================= */

    function renderEverything() {

        renderStats();

        renderTechnicians();

        renderCategories();

        renderSla();

        renderPriorities();

        renderTrend();

        renderSummary();
    }


    /* =========================================================
       EVENTS
    ========================================================= */

    function setupEvents() {

        const period =
            get(
                "periodFilter"
            );


        period
            ?.addEventListener(
                "change",
                async event => {

                    event.stopImmediatePropagation();


                    try {

                        await loadReport(
                            true
                        );

                    } catch (
                        error
                    ) {

                        showToast(
                            error.message
                        );
                    }

                },
                true
            );


        const department =
            get(
                "departmentFilter"
            );


        department
            ?.addEventListener(
                "change",
                async event => {

                    event.stopImmediatePropagation();


                    populateCategoryFilter(
                        allCategories
                    );


                    try {

                        await loadReport(
                            true
                        );

                    } catch (
                        error
                    ) {

                        showToast(
                            error.message
                        );
                    }

                },
                true
            );


        const category =
            get(
                "categoryFilter"
            );


        category
            ?.addEventListener(
                "change",
                async event => {

                    event.stopImmediatePropagation();


                    try {

                        await loadReport(
                            true
                        );

                    } catch (
                        error
                    ) {

                        showToast(
                            error.message
                        );
                    }

                },
                true
            );


        get(
            "refreshButton"
        )
            ?.addEventListener(
                "click",
                async event => {

                    event.preventDefault();

                    event.stopImmediatePropagation();


                    try {

                        await loadReport(
                            true
                        );

                    } catch (
                        error
                    ) {

                        showToast(
                            error.message
                        );
                    }

                },
                true
            );


        get(
            "exportButton"
        )
            ?.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    event.stopImmediatePropagation();


                    exportCsv();

                },
                true
            );


        get(
            "topSearch"
        )
            ?.addEventListener(
                "input",
                event => {

                    event.stopImmediatePropagation();


                    renderTechnicians();

                },
                true
            );
    }


    /* =========================================================
       TOAST
    ========================================================= */

    function showToast(
        message
    ) {

        const toast =
            get(
                "toast"
            );


        if (!toast) {

            console.log(
                message
            );

            return;
        }


        toast.textContent =
            message;


        toast.classList.add(
            "show"
        );


        clearTimeout(
            toastTimer
        );


        toastTimer =
            setTimeout(
                () => {

                    toast.classList
                        .remove(
                            "show"
                        );

                },
                2400
            );
    }


    /* =========================================================
       INIT
    ========================================================= */

    async function init() {

        setupEvents();


        try {

            await loadReport();

        } catch (
            error
        ) {

            console.error(
                "❌ Reports page:",
                error
            );


            showToast(
                error.message
            );
        }
    }


    init();

})();